import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest } from "next";
import { Speaker, SpeakerIdentity } from "@/lib/speakerLabeler";
import { TranscriptApiData } from "@/types/types";
import { Connection, connect } from "@planetscale/database";
import { assertString } from "@/utils/assert";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { strictParseInt } from "@/utils/number";
import { canAccessResourceWithOrgId } from "@/utils/resourceAccess";
import { getSiteFromHeaders } from "@/utils/site";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export const config = {
  runtime: "edge",
};

export type ApiLabelSpeakerResponseResult1 = {
  isFallback: boolean;
  labelsToSpeaker?: { [label: string]: Speaker };
  transcript: TranscriptApiData;
  knownSpeakers: string[];
  isPreviewTranscriptDone: boolean;
  isPreviewTranscriptEmpty: boolean;
};

export type ApiLabelSpeakerResponseResult2 = {
  name: string;
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const site = getSiteFromHeaders(req.headers);

  if (req.method === "GET") {
    const rawTranscriptId = new URL(assertString(req.url)).searchParams.get("tid");
    const transcriptId = strictParseInt(rawTranscriptId, "transcript ID");

    const accessResult = await canAccessResourceWithOrgId(
      "transcripts",
      transcriptId,
      userId,
      site
    );
    if (!accessResult.hasAccess) {
      return new Response(null, { status: 403 });
    }
    const orgId = accessResult.orgId;

    const snippetRows = await conn
      .execute(
        "SELECT snippet, language, preview_transcribe_finished, userId, org_id FROM transcripts WHERE id = ?",
        [transcriptId]
      )
      .then((result) => result.rows);

    const snippet: string | undefined = snippetRows[0]?.snippet;
    const isPreviewTranscriptDone = Boolean(snippetRows[0]?.preview_transcribe_finished);
    const language: string | undefined = snippetRows[0]?.language;
    const transcriptUserId = snippetRows[0]?.userId as string;
    const transcriptOrgId = snippetRows[0]?.org_id as string | null;

    let {
      labelsToSpeaker,
      knownSpeakers,
    }: { labelsToSpeaker: { [label: string]: Speaker }; knownSpeakers: string[] } =
      await getLabelsToSpeaker(conn, transcriptId, transcriptUserId, transcriptOrgId, {
        fastMode: false,
      });
    if (Object.keys(labelsToSpeaker).length === 0) {
      // If non-fast speaker labels aren't ready, use the fast mode labels
      ({ labelsToSpeaker, knownSpeakers } = await getLabelsToSpeaker(
        conn,
        transcriptId,
        transcriptUserId,
        transcriptOrgId,
        {
          fastMode: true,
        }
      ));
    } else {
      // TODO(#333): We should check if we need to transfer over fast-speakers that
      // have been labeled.
    }

    const [transcriptRows, transcriptRowsFast] = await Promise.all([
      getTranscript(conn, transcriptId, { fastMode: false }),
      getTranscript(conn, transcriptId, { fastMode: true }),
    ]);

    const isPreviewTranscriptEmpty =
      isPreviewTranscriptDone &&
      transcriptRowsFast.length === 0 &&
      // language != null means we used Google Translate, and in this case we don't support preview transcripts
      language == null;

    // For transcript rows, we want to use the non-fast mode rows if they exist, otherwise fallback to fast mode rows
    let transcriptUnion = transcriptRows;
    if (transcriptRows.length === 0) {
      transcriptUnion = transcriptRowsFast;
    } else {
      // If there are non-fast mode rows with no transcript, we want to merge in the fast mode rows
      for (let i = 0; i < transcriptRowsFast.length; ++i) {
        const row = transcriptRowsFast[i];
        if (i < transcriptRows.length && transcriptRows[i].transcript == null) {
          transcriptRows[i].transcript = row.transcript;
        }
      }
    }

    let transcript: TranscriptApiData = {
      segments: transcriptUnion.map((transcript: Transcript, index: number) => {
        if (transcript.is_user_visible || index < transcriptRowsFast.length) {
          return transcript;
        }
        return {
          ...transcript,
          transcript: null,
        };
      }),
      speakers: {
        count: Object.entries(labelsToSpeaker).length,
        labels: Object.keys(labelsToSpeaker),
        embeddings: {},
      },
    };

    if (transcript.segments.length === 0) {
      const TRANSCRIPT_FALLBACK_DATA = {
        segments: [],
        speakers: {},
      };
      if (snippet != null) {
        (TRANSCRIPT_FALLBACK_DATA.segments as any).push({
          speaker: "A",
          start: "0:00:00.000",
          stop: "0:00:04.000",
          transcript: `${snippet}...`,
          is_user_visible: true,
        });
      }

      const LABEL_SPEAKER_FALLBACK_DATA = {
        A: { id: 0, name: "Speaker 1", uses: 0 },
      };

      return new Response(
        JSON.stringify({
          isFallback: true,
          labelsToSpeaker: LABEL_SPEAKER_FALLBACK_DATA,
          knownSpeakers: [],
          transcript: TRANSCRIPT_FALLBACK_DATA,
          isPreviewTranscriptDone,
          isPreviewTranscriptEmpty,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      if (!transcript.segments[0].transcript) {
        transcript.segments[0] = {
          speaker: "A",
          start: "0:00:00.000",
          stop: "0:00:04.000",
          transcript: `${snippet}...`,
          is_user_visible: true,
        };
      }

      return new Response(
        JSON.stringify({
          isFallback: false,
          labelsToSpeaker,
          knownSpeakers,
          transcript,
          isPreviewTranscriptDone,
          isPreviewTranscriptEmpty,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  const speaker = (await req.json()) as Speaker;

  const speakerRow = await conn
    .execute("SELECT s.id, s.transcriptId FROM speakers s WHERE s.id = ?", [speaker.id])
    .then((result) => result.rows[0]);

  if (!speakerRow) {
    return new Response(null, { status: 404 });
  }

  const transcriptId = speakerRow.transcriptId as number;
  const accessResult = await canAccessResourceWithOrgId("transcripts", transcriptId, userId, site);
  if (!accessResult.hasAccess) {
    return new Response(null, { status: 403 });
  }

  await conn.execute(
    "UPDATE speakers SET name = ?, uses = ?, suggested_speakers = ? WHERE id = ?",
    [
      speaker.name,
      speaker.uses,
      speaker.suggestedSpeakers
        ? JSON.stringify({ suggested_identities: speaker.suggestedSpeakers })
        : null,
      speaker.id,
    ]
  );

  return new Response(
    JSON.stringify({
      name: speaker.name,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

type Transcript = {
  speaker: string;
  start: string;
  stop: string;
  transcript: string | null;
  is_user_visible: boolean;
};

async function getTranscript(
  conn: Connection,
  transcriptId: number,
  options: {
    fastMode: boolean;
  }
): Promise<Transcript[]> {
  try {
    return await conn
      .execute<Transcript>(
        "SELECT speaker, start, stop, transcript, is_user_visible FROM gc_segments WHERE transcript_id = ? AND fast_mode = ? ORDER BY CAST(start AS TIME);",
        [transcriptId, options.fastMode ? 1 : 0]
      )
      .then((result) => result.rows);
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      console.warn(
        "[label-speaker] is_user_visible column not found in gc_segments " +
          "(schema migration pending). Falling back to query without it."
      );
      const rows = await conn
        .execute<Omit<Transcript, "is_user_visible">>(
          "SELECT speaker, start, stop, transcript FROM gc_segments WHERE transcript_id = ? AND fast_mode = ? ORDER BY CAST(start AS TIME);",
          [transcriptId, options.fastMode ? 1 : 0]
        )
        .then((result) => result.rows);
      return rows.map((r) => ({ ...r, is_user_visible: true }));
    }
    throw err;
  }
}

async function getLabelsToSpeaker(
  conn: Connection,
  transcriptId: number,
  transcriptUserId: string,
  transcriptOrgId: string | null,
  options: { fastMode: boolean }
): Promise<{ knownSpeakers: string[]; labelsToSpeaker: { [p: string]: Speaker } }> {
  const rows = transcriptOrgId
    ? await conn
        .execute(
          `SELECT
             s.id,
             s.transcriptId,
             s.label,
             s.name,
             s.uses,
             s.suggested_speakers,
             s.tags
           FROM speakers s
           INNER JOIN transcripts t ON s.transcriptId = t.id
           WHERE t.org_id = ?
             AND s.fast_mode = ?`,
          [transcriptOrgId, options.fastMode ? 1 : 0]
        )
        .then((result) => result.rows)
    : await conn
        .execute(
          `SELECT
             id,
             transcriptId,
             label,
             name,
             uses,
             suggested_speakers,
             tags
           FROM speakers
           WHERE userId = ?
             AND fast_mode = ?`,
          [transcriptUserId, options.fastMode ? 1 : 0]
        )
        .then((result) => result.rows);

  const labelsToSpeaker: { [label: string]: Speaker } = {};

  const speakerNames = new Set<string>();
  for (const row of rows as unknown as (Speaker & {
    transcriptId: string;
    label: string;
    suggested_speakers: { suggested_identities: SpeakerIdentity[] };
    tags: string[];
  })[]) {
    if (!row.tags?.includes("example")) {
      // speaker names cannot be null in sql as speaker # is automatically assigned.
      speakerNames.add(row.name);
    }

    if (parseInt(row.transcriptId, 10) !== transcriptId) {
      continue;
    }
    const suggestedSpeakers =
      row.suggested_speakers?.suggested_identities?.map((identity: any) => ({
        id: identity.id,
        name: identity.name,
        similarityScore: identity["similarity_score"],
      })) || undefined;

    labelsToSpeaker[row.label] = {
      id: row.id,
      name: row.name,
      uses: row.uses,
      suggestedSpeakers,
    };
  }

  const speakerNamesArray = Array.from(speakerNames);
  const speakerNamesArrayFiltered = speakerNamesArray.filter((name) => !name.match(/Speaker \d+/));
  const knownSpeakers: string[] = speakerNamesArrayFiltered.sort((a, b) => a.localeCompare(b));
  return { labelsToSpeaker, knownSpeakers };
}

export default withErrorReporting(handler);
