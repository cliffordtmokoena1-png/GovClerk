import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { S3RequestPresigner, getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseUrl } from "@aws-sdk/url-parser";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, getUploadKey, Region } from "@/utils/s3";
import { PresignedUrl } from "@/common/types";
import { PRESIGNED_URL_TTL, S3_PART_SIZE, S3_BIGGER_PART_SIZE } from "@/common/constants";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";

export type ApiS3ResponseResult = {
  uploadId: string;
  transcriptId: number;
  presignedUrls: Array<PresignedUrl>;
};

export type CreateS3UploadParams = {
  transcriptId: number;
  fileSize?: number; // Optional for streaming uploads
  region: Region;
  useBiggerPartSize: boolean;
  userId?: string; // For regular uploads (with user auth check)
  isAdminUpload?: boolean; // For admin uploads (skip user auth check)
};

export async function createS3Upload(params: CreateS3UploadParams): Promise<ApiS3ResponseResult> {
  const { transcriptId, fileSize, region, useBiggerPartSize, userId, isAdminUpload } = params;

  const key = getUploadKey(transcriptId, isAdminUpload ? { env: "prod" } : undefined);
  const partSize = useBiggerPartSize ? S3_BIGGER_PART_SIZE : S3_PART_SIZE;
  const numberOfParts = fileSize ? Math.max(1, Math.ceil(fileSize / partSize)) : 0;

  const createMultipartUploadCommand = new CreateMultipartUploadCommand({
    Bucket: getTranscriptBucketNameByRegion(region),
    Key: key,
  });

  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  const { UploadId } = await s3.send(createMultipartUploadCommand);
  if (UploadId == null) {
    throw new Error(
      `Failed to get uploadId from multipart upload create for ${transcriptId}, number of parts: ${numberOfParts}`
    );
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const updateQuery = isAdminUpload
    ? "UPDATE transcripts SET s3AudioKey = ?, file_size = ?, client_corruption = 0 WHERE id = ?;"
    : "UPDATE transcripts SET s3AudioKey = ?, file_size = ?, client_corruption = 0 WHERE id = ? AND userId = ?;";

  const updateParams = isAdminUpload
    ? [key, fileSize, transcriptId]
    : [key, fileSize, transcriptId, userId];

  const [_, presignedUrls] = await Promise.all([
    conn.execute(updateQuery, updateParams),
    numberOfParts > 0
      ? Promise.all(
          Array.from({ length: numberOfParts }, async (_, index) => {
            const partNumber = index + 1;
            const command = new UploadPartCommand({
              Bucket: getTranscriptBucketNameByRegion(region),
              Key: key,
              UploadId,
              PartNumber: partNumber,
            });

            // @ts-expect-error
            const url = await getSignedUrl(s3, command, {
              expiresIn: PRESIGNED_URL_TTL,
            });
            return {
              partNumber,
              url,
              start: (partNumber - 1) * partSize,
              end: Math.min(partNumber * partSize, fileSize!),
              eTag: null,
            };
          })
        )
      : Promise.resolve([]),
  ]);

  return {
    uploadId: UploadId,
    transcriptId,
    presignedUrls,
  };
}

export async function getPresignedPartUrl(
  region: Region,
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  const command = new UploadPartCommand({
    Bucket: getTranscriptBucketNameByRegion(region),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  // @ts-expect-error
  return await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_TTL,
  });
}

export async function getPresignedGetterLink(region: Region, key: string): Promise<string> {
  const s3url = `https://${getTranscriptBucketNameByRegion(region)}.s3.${region}.amazonaws.com/${key}`;
  const s3ObjectUrl = parseUrl(s3url.toString());
  const presigner = new S3RequestPresigner({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
    sha256: Hash.bind(null, "sha256"),
  });

  // Create a GET request from S3 url.
  const result = formatUrl(
    await presigner.presign(new HttpRequest(s3ObjectUrl), {
      expiresIn: 7200,
    })
  );
  return result;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiS3ResponseResult>) {
  const { userId } = getAuth(req);
  if (userId == null) {
    res.status(401).json({
      uploadId: "",
      transcriptId: -1,
      presignedUrls: [],
    });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const transcriptId = body["transcriptId"];
  const fileSize: number | undefined = body["fileSize"];
  const region: Region = body["region"];
  const useBiggerPartSize: boolean = Boolean(body["useBiggerPartSize"]);

  const result = await createS3Upload({
    transcriptId,
    fileSize,
    region,
    useBiggerPartSize,
    userId,
  });

  return res.status(200).json(result);
}

export default withErrorReporting(handler);
