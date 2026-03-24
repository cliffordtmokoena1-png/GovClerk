import { getAuth } from "@clerk/nextjs/server";
import { serverUri } from "@/utils/server";
import { NextRequest } from "next/server";
import { assertString } from "@/utils/assert";
import { isDev } from "@/utils/dev";
import withErrorReporting from "@/error/withErrorReporting";
import { strictParseInt } from "@/utils/number";

export const config = {
  runtime: "edge",
};

export async function transcribeSegments(transcriptId: number) {
  const testQueryParam = isDev() ? "&test=1" : "";
  const targetUrl = serverUri(`/api/resume-transcribe?transcriptId=${transcriptId}${testQueryParam}`);

  const webhookSecret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (webhookSecret) {
    headers["Authorization"] = `Bearer ${webhookSecret}`;
  }

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
  } catch (networkErr) {
    console.error(
      `[transcribeSegments] Network error calling transcription server (transcriptId=${transcriptId}):`,
      networkErr
    );
    throw new Error(
      `Transcription server unreachable: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`
    );
  }

  if (!res.ok) {
    const responseBody = await res.text().catch(() => "(unreadable)");
    console.error(
      `[transcribeSegments] Transcription server returned error for transcriptId=${transcriptId}: ` +
        `status=${res.status}, body=${responseBody}`
    );
    throw new Error(`Transcription server returned ${res.status}: ${responseBody}`);
  }
}

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const transcriptId = strictParseInt(
    assertString(req.nextUrl.searchParams.get("transcriptId")),
    "transcript ID"
  );

  try {
    await transcribeSegments(transcriptId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[resume-transcribe] Transcription pipeline failed for transcript ${transcriptId}:`,
      err
    );
    return new Response(
      JSON.stringify({
        error: "The transcription pipeline failed to start.",
        detail: message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
