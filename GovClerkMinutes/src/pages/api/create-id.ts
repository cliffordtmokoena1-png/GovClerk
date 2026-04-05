import { connect } from "@planetscale/database";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { capture } from "@/utils/posthog";
import withErrorReporting from "@/error/withErrorReporting";
import { waitUntil } from "@vercel/functions";
import { assertUploadKind, UploadKind } from "@/uploadKind/uploadKind";
import { resolveRequestContext } from "@/utils/resolveRequestContext";

export const config = {
  runtime: "edge",
};

export type ApiCreateIdResponse = {
  transcriptId: number;
};

export type CreateIdParams = {
  userId: string;
  orgId?: string | null;
  title: string | null;
  uploadKind: UploadKind;
  fileSize: number | null;
  region: string | null;
  isRecording?: boolean; // For recorder uploads
  language?: string; // Optional language code (e.g. "en", "zu", "xh"); omit for auto-detect
};

export async function createId(params: CreateIdParams): Promise<ApiCreateIdResponse> {
  const { userId, orgId, title, uploadKind, fileSize, region, isRecording, language } = params;

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const shouldMarkAsFailed = uploadKind === "unknown" || (fileSize === 0 && !isRecording);
  const maybeFailSql = shouldMarkAsFailed ? ", transcribe_failed" : "";
  let maybeFailSqlValue = "";
  if (uploadKind === "unknown") {
    maybeFailSqlValue = ", 12";
  } else if (fileSize === 0 && !isRecording) {
    maybeFailSqlValue = ", 13";
  }

  const extension = title && (title.match(/\.([^.]+)$/)?.[1] ?? null);

  // Include language in the INSERT only when a specific language was selected
  const hasLanguage = !!language && language !== "";
  const maybeLanguageSql = hasLanguage ? ", language" : "";
  const maybeLanguageValue = hasLanguage ? ", ?" : "";
  const insertValues: (string | number | boolean | null | undefined)[] = [
    userId,
    orgId,
    title,
    fileSize,
    region,
    uploadKind,
    isRecording ? 0 : -1,
    extension,
  ];
  if (hasLanguage) {
    insertValues.push(language);
  }

  const insertId = await conn
    .execute(
      `
      INSERT INTO transcripts
      (userId, org_id, dateCreated, title, file_size, aws_region, upload_kind${maybeFailSql}, recording_state, extension${maybeLanguageSql})
      VALUES (?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?${maybeFailSqlValue}, ?, ?${maybeLanguageValue});
      `,
      insertValues
    )
    .then((result) => result.insertId);

  // Delay non-critical work so we can return a response ASAP
  waitUntil(
    (async () => {
      await capture(
        "transcribe_started",
        {
          transcript_id: insertId,
          title,
          file_size: fileSize,
          upload_kind: uploadKind,
          recording: isRecording,
        },
        userId
      );
    })()
  );

  return {
    transcriptId: parseInt(insertId),
  };
}

async function handler(req: NextRequest) {
  const auth = getAuth(req);
  if (auth.userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json();
  const title = body.title as string | null;
  const uploadKind = assertUploadKind(body.uploadKind);
  const fileSize = body.fileSize as number | null;
  const region = body.region as string | null;
  const isRecording = body.isRecording as boolean | undefined;
  const language = body.language as string | undefined;

  const { userId, orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  const result = await createId({
    userId,
    orgId,
    title,
    uploadKind,
    fileSize,
    region,
    isRecording,
    language,
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
