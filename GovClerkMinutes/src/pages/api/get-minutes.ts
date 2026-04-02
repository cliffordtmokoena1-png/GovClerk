import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { ApiGetMinutesResponseResult } from "@/components/Minutes";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { canAccessResourceWithOrgId } from "@/utils/resourceAccess";
import { getSiteFromHeaders } from "@/utils/site";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json();
  const transcriptId = body.transcriptId as number | null;

  if (transcriptId == null) {
    const res: ApiGetMinutesResponseResult = {
      status: "NOT_STARTED",
    };
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const site = getSiteFromHeaders(req.headers);
  const accessResult = await canAccessResourceWithOrgId("transcripts", transcriptId, userId, site);
  if (!accessResult.hasAccess) {
    return new Response(null, { status: 403 });
  }
  const orgId = accessResult.orgId;

  const [transcribeRow] = await conn
    .execute("SELECT transcribe_finished, transcribe_failed, userId, org_id FROM transcripts WHERE id = ?;", [
      transcriptId,
    ])
    .then((res) => res.rows);
  if (!transcribeRow) {
    return new Response(null, { status: 404 });
  }
  const transcribeFinished = transcribeRow["transcribe_finished"] === 1;
  const transcribeFailed = (transcribeRow["transcribe_failed"] as number) > 0;
  const transcriptUserId = transcribeRow["userId"] as string;
  const transcriptOrgId = transcribeRow["org_id"] as string | null;

  const stepNames = [
    { key: "transcribe", label: "Transcribing audio" },
    { key: "meeting_notes", label: "Creating meeting notes" },
    { key: "first_draft", label: "Creating first draft" },
    { key: "review", label: "Reviewing draft" },
    { key: "final_minutes", label: "Creating your minutes" },
  ];

  async function getStepStatus(stepKey: string): Promise<string> {
    let stepName;
    switch (stepKey) {
      case "meeting_notes":
        stepName = "MeetingNotes";
        break;
      case "first_draft":
        stepName = "FirstDraft";
        break;
      case "review":
        stepName = "OracleFeedback";
        break;
      case "final_minutes":
        stepName = "FinalMinutes";
        break;
      default:
        return "NotStarted";
    }
    try {
      const rows = transcriptOrgId
        ? await conn
            .execute(
              "SELECT status FROM minutes_step_state WHERE transcript_id = ? AND org_id = ? AND step = ? ORDER BY updated_at DESC LIMIT 1;",
              [transcriptId, transcriptOrgId, stepName]
            )
            .then((res) => res.rows)
        : await conn
            .execute(
              "SELECT status FROM minutes_step_state WHERE transcript_id = ? AND user_id = ? AND step = ? ORDER BY updated_at DESC LIMIT 1;",
              [transcriptId, transcriptUserId, stepName]
            )
            .then((res) => res.rows);
      return rows[0]?.status || "NotStarted";
    } catch (err) {
      if (isUnknownColumnOrMissingTableError(err)) {
        console.warn(
          "[get-minutes] minutes_step_state table not found (schema migration pending). " +
            `Returning NotStarted for step=${stepName}.`
        );
        return "NotStarted";
      }
      throw err;
    }
  }

  const steps = [];
  // Step 1: Transcribe
  steps.push({ name: stepNames[0].label, status: transcribeFinished ? "Success" : "InProgress" });
  // Steps 2-5
  for (let i = 1; i < stepNames.length; i++) {
    const status = await getStepStatus(stepNames[i].key);
    steps.push({ name: stepNames[i].label, status });
  }

  const rows = transcriptOrgId
    ? await conn
        .execute(
          "SELECT minutes, rating, version, fast_mode FROM minutes WHERE transcript_id = ? AND org_id = ? AND ((fast_mode = 1 AND version = 1) OR (fast_mode = 0 AND version >= 1)) ORDER BY fast_mode DESC, version ASC;",
          [transcriptId, transcriptOrgId]
        )
        .then((res) => res.rows)
    : await conn
        .execute(
          "SELECT minutes, rating, version, fast_mode FROM minutes WHERE transcript_id = ? AND user_id = ? AND ((fast_mode = 1 AND version = 1) OR (fast_mode = 0 AND version >= 1)) ORDER BY fast_mode DESC, version ASC;",
          [transcriptId, transcriptUserId]
        )
        .then((res) => res.rows);

  const allMinutes = rows.filter((row) => row["fast_mode"] === 0).map((row) => row["minutes"]);

  if (allMinutes.length === 0) {
    const res: ApiGetMinutesResponseResult & { transcribeFailed?: boolean } = {
      status: "NOT_STARTED",
      steps,
      ...(transcribeFailed ? { transcribeFailed: true } : {}),
    };
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Check if the last minute is still pending (null)
  if (allMinutes[allMinutes.length - 1] == null) {
    const res: ApiGetMinutesResponseResult = {
      status: "IN_PROGRESS",
      minutes: allMinutes.filter((m) => m != null),
      steps,
    };
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // All minutes are complete, filter out any nulls (shouldn't be any at this point)
  const minutes = allMinutes.filter((m) => m != null);

  const response: ApiGetMinutesResponseResult = {
    status: "COMPLETE",
    minutes,
    rating: rows.find(
      (row) => row["fast_mode"] === 0 && row["minutes"] === minutes[minutes.length - 1]
    )?.rating,
  };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
