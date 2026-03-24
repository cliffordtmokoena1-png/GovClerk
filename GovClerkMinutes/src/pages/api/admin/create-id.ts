import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { createId, ApiCreateIdResponse } from "../create-id";
import { assertUploadKind } from "@/uploadKind/uploadKind";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiCreateIdResponse | { error: string }>
) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);

  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const userId = body.userId as string;
    const title = body.title as string | null;
    const uploadKind = assertUploadKind(body.uploadKind);
    const fileSize = body.fileSize as number | null;
    const region = body.region as string | null;

    const result = await createId({
      userId,
      title,
      uploadKind,
      fileSize,
      region,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[admin/create-id] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(handler);
