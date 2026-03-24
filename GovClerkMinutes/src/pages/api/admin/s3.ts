import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { Region } from "@/utils/s3";
import withErrorReporting from "@/error/withErrorReporting";
import { createS3Upload, ApiS3ResponseResult } from "../s3";

export type ApiAdminS3ResponseResult = ApiS3ResponseResult;

async function handler(req: NextApiRequest, res: NextApiResponse<ApiAdminS3ResponseResult | {}>) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);

  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return res.status(401).json({});
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const transcriptId = body["transcriptId"];
    const fileSize: number = body["fileSize"];
    const region: Region = body["region"];
    const useBiggerPartSize: boolean = Boolean(body["useBiggerPartSize"]);

    const result = await createS3Upload({
      transcriptId,
      fileSize,
      region,
      useBiggerPartSize,
      isAdminUpload: true,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[admin/s3] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(handler);
