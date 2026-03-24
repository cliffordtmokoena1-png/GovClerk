import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, type Region } from "@/utils/s3";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "nodejs",
};

const DEFAULT_REGION: Region = "us-east-2";

function getS3Client() {
  return new S3Client({
    region: DEFAULT_REGION,
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { artifactId } = req.query as { artifactId: string };

  if (!artifactId) {
    res.status(400).json({ error: "Artifact ID is required" });
    return;
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const conn = getPortalDbConnection();

  // Fetch the artifact first
  const artifactResult = await conn.execute(
    "SELECT id, org_id, s3_key, file_name FROM gc_artifacts WHERE id = ?",
    [artifactId]
  );

  if (artifactResult.rows.length === 0) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  const artifact = artifactResult.rows[0] as {
    id: string;
    org_id: string;
    s3_key: string;
    file_name: string;
  };

  // Verify user belongs to the org that owns this artifact
  // For PATCH/DELETE, we can use the artifact's org_id to verify membership
  const { orgId } = await resolveRequestContext(auth.userId, artifact.org_id, req.headers);

  if (!orgId || orgId !== artifact.org_id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (req.method === "DELETE") {
    // Delete from S3
    const s3Client = getS3Client();
    const bucket = getTranscriptBucketNameByRegion(DEFAULT_REGION);

    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: artifact.s3_key,
        })
      );
    } catch (s3Error) {
      console.error("Failed to delete from S3:", s3Error);
      // Continue with DB deletion even if S3 fails
    }

    // Delete from database
    await conn.execute("DELETE FROM gc_artifacts WHERE id = ?", [artifactId]);

    res.status(200).json({ success: true });
    return;
  }

  if (req.method === "PATCH") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { fileName, artifactType, isPublic } = body;

    if (!fileName && !artifactType && isPublic === undefined) {
      res.status(400).json({ error: "fileName, artifactType, or isPublic is required" });
      return;
    }

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (fileName && typeof fileName === "string") {
      updates.push("file_name = ?");
      values.push(fileName);
    }

    if (artifactType && typeof artifactType === "string") {
      updates.push("artifact_type = ?");
      values.push(artifactType);
    }

    if (isPublic !== undefined && typeof isPublic === "boolean") {
      updates.push("is_public = ?");
      values.push(isPublic ? 1 : 0);
    }

    updates.push("updated_at = ?");
    values.push(now);
    values.push(artifactId);

    await conn.execute(`UPDATE gc_artifacts SET ${updates.join(", ")} WHERE id = ?`, values);

    res.status(200).json({ success: true, fileName, artifactType, isPublic });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

export default withErrorReporting(handler);
