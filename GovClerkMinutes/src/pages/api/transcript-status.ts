import { assert, assertString } from "@/utils/assert";
import { getAuth } from "@clerk/nextjs/server";
import { getCurrentBalance } from "./get-tokens";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { UploadKind } from "@/uploadKind/uploadKind";
import { strictParseInt } from "@/utils/number";
import { canAccessResourceWithOrgId } from "@/utils/resourceAccess";
import { getSiteFromHeaders } from "@/utils/site";
import type { Site } from "@/utils/site";

export const config = {
  runtime: "edge",
};

export type ApiTranscriptStatusResponseResult = {
  audioSrc?: string;
  diarizationReady?: boolean;
  insufficientToken: boolean;
  uploadComplete?: boolean;
  tokensRequired?: number;
  currentBalance?: number;
  transcribeFailed?: boolean;
  transcribeFailedMessage?: string;
  transcribeFinished?: boolean;
  previewTranscribeFinished?: boolean;
  transcribePaused?: boolean;
  nonNullTranscriptCount?: number;
  totalTranscriptCount?: number;
  uploadKind?: UploadKind;
  extension?: string;
  title?: string;
  recordingState?: string;
  language?: string;
};

function getTranscribeFailedMessage(transcribeFailed: number): string {
  switch (transcribeFailed) {
    case 0:
      return "";
    case 11:
      return "The uploaded file is corrupted.  Try double clicking on the file on your computer to see if it plays locally.  If it does, then reach out to support.";
    case 12:
      return "Unsupported file type.  Please upload an audio, video, text, or Word file.";
    case 13:
      return "The uploaded file is empty!  Does it play locally on your computer when double clicked?  If yes, then chat with our support.";
    case 62:
      return "Creating transcript failed!  Please try again.";
    case 63:
      return "Speaker detection failed!  This can happen when a recording is very short, or has no speakers.  Try again if this is not the case.";
    case 69:
      return "Upload timed out.  Please try again.";
    case 101:
      return "Upload error.  This is a temporary error in our system.  Please try again later!";
    case 1:
      return "The transcription pipeline failed to start. Please use the 'Retry Transcription' button or return to the Dashboard and retry your upload.";
    case 50:
      return "The transcription pipeline failed to start. Please use the 'Retry Transcription' button to try again without re-uploading.";
    default:
      return "An unexpected error occurred while processing your file. Please try uploading again.";
  }
}

export async function getTranscriptStatus(
  transcriptId: number | undefined,
  userId: string | null,
  site?: Site
): Promise<ApiTranscriptStatusResponseResult> {
  if (transcriptId == null || userId == null) {
    return { insufficientToken: false };
  }

  const { hasAccess, orgId } = await canAccessResourceWithOrgId(
    "transcripts",
    transcriptId,
    userId,
    site
  );
  if (!hasAccess) {
    return { insufficientToken: false };
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const [rows, currentBalance] = await Promise.all([
    conn
      .execute(
        `
        SELECT
          lastTranscriptionRequest,
          s3AudioKey,
          prompt,
          dateCreated,
          transcribe_failed,
          diarization_ready,
          credits_required,
          upload_complete,
          transcribe_finished,
          preview_transcribe_finished,
          transcribe_paused,
          upload_kind,
          title,
          recording_state,
          language,
          extension
        FROM transcripts
        WHERE id = ?
        `,
        [transcriptId]
      )
      .then((result) => result.rows),
    getCurrentBalance(userId, orgId),
  ]);

  assert(rows.length < 2);

  if (rows.length === 0) {
    return { insufficientToken: false };
  }

  const row = rows[0];
  const transcribe_failed = row["transcribe_failed"];
  const diarization_ready = row["diarization_ready"];
  const tokens_required = row["credits_required"];
  const upload_complete = row["upload_complete"];
  const transcribe_finished = row["transcribe_finished"];
  const preview_transcribe_finished = row["preview_transcribe_finished"];
  const transcribe_paused = row["transcribe_paused"];
  const upload_kind: UploadKind = row["upload_kind"];
  const title = row["title"];
  const recording_state = row["recording_state"];
  const language = row["language"];
  const extension = row["extension"];

  let nonNullTranscriptCount;
  let totalTranscriptCount;
  if (diarization_ready) {
    const countRows = await conn
      .execute(
        "SELECT fast_mode, SUM(CASE WHEN transcript IS NULL THEN 0 ELSE 1 END) AS non_null_transcript_count, COUNT(*) AS total_count FROM gc_segments WHERE transcript_id = ? GROUP BY fast_mode ORDER BY fast_mode ASC;",
        [transcriptId]
      )
      .then((result) => result.rows);
    const full = countRows[0]; // fast_mode === 0
    const fast = countRows[1]; // fast_mode === 1

    if (full != null) {
      const { non_null_transcript_count: full_transcript_count, total_count } = full;

      if (fast != null) {
        const { non_null_transcript_count: fast_transcript_count } = fast;

        nonNullTranscriptCount = Math.max(
          parseInt(full_transcript_count),
          parseInt(fast_transcript_count)
        );
        totalTranscriptCount = parseInt(total_count);
      } else {
        nonNullTranscriptCount = parseInt(full_transcript_count);
        totalTranscriptCount = parseInt(total_count);
      }
    }
  }

  const audioSrc = "/api/audio-shim?tid=" + transcriptId;

  const recordingState = (recording_state: number) => {
    switch (recording_state) {
      case 0:
        return "recording";
      case 1:
        return "completed";
      default:
        return undefined;
    }
  };

  const status = {
    audioSrc,
    diarizationReady: diarization_ready !== 0,
    uploadComplete: upload_complete !== 0,
    insufficientToken: tokens_required !== null && tokens_required > 0 && currentBalance !== null && currentBalance < tokens_required,
    ...(tokens_required == null ? {} : { tokensRequired: tokens_required }),
    ...(currentBalance == null ? {} : { currentBalance }),
    transcribeFailed: transcribe_failed !== 0,
    transcribeFailedMessage: getTranscribeFailedMessage(transcribe_failed),
    transcribeFinished: transcribe_finished !== 0,
    previewTranscribeFinished: preview_transcribe_finished !== 0,
    transcribePaused: transcribe_paused !== 0,
    ...(nonNullTranscriptCount == null ? {} : { nonNullTranscriptCount }),
    ...(totalTranscriptCount == null ? {} : { totalTranscriptCount }),
    uploadKind: upload_kind == null ? "audio" : upload_kind,
    title: title == null ? "" : title,
    ...(recordingState(recording_state) ? { recordingState: recordingState(recording_state) } : {}),
    ...(language ? { language } : {}),
    ...(extension ? { extension } : {}),
  };

  return status;
}

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const rawTranscriptId = new URL(assertString(req.url)).searchParams.get("tid");
  const transcriptId =
    rawTranscriptId == null ? undefined : strictParseInt(rawTranscriptId, "transcript ID");
  const site = getSiteFromHeaders(req.headers);
  const status = await getTranscriptStatus(transcriptId, userId, site);

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
