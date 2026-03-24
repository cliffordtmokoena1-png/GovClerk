import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, getUploadKey, Region } from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";
import { ApiRefreshPresignedUrlResponse } from "@/common/types";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";

async function handler(req: NextApiRequest, res: NextApiResponse<ApiRefreshPresignedUrlResponse>) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).json({
      transcriptId: -1,
      presignedUrls: [],
    });
  }

  const body = JSON.parse(req.body);
  const transcriptId: number = body["transcriptId"];
  const uploadId = body["uploadId"];
  const parts: Array<number> = body["parts"];

  if (transcriptId == null || uploadId == null || parts == null) {
    return res.status(400).json({
      transcriptId: -1,
      presignedUrls: [],
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute("SELECT aws_region FROM transcripts WHERE id = ? and userId = ?;", [
      transcriptId,
      userId,
    ])
    .then((res) => res.rows);

  const region: Region = rows[0]?.aws_region;

  const key = getUploadKey(transcriptId);

  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    endpoint: "https://s3-accelerate.amazonaws.com",
    region,
  });

  const presignedUrls = await Promise.all(
    parts.map(async (partNumber) => {
      const command = new UploadPartCommand({
        Bucket: getTranscriptBucketNameByRegion(region),
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      // @ts-expect-error
      const url = await getSignedUrl(s3, command, {
        expiresIn: PRESIGNED_URL_TTL,
      });
      return {
        partNumber,
        url,
      };
    })
  );

  return res.status(200).json({
    transcriptId,
    presignedUrls,
  });
}

export default withErrorReporting(handler);
