import { getAuth } from "@clerk/nextjs/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getTranscriptBucketNameByRegion, getUploadKey, Region } from "@/utils/s3";
import { assertString } from "@/utils/assert";
import { NextApiRequest, NextApiResponse } from "next";
import { prodServerUri, serverUri } from "@/utils/server";
import { forceProdServerInDev, isDev, isPreview, isProd } from "@/utils/dev";
import withErrorReporting from "@/error/withErrorReporting";

function getUri(isFast: boolean): string {
  return forceProdServerInDev()
    ? prodServerUri("/api/get-diarization?test=1&prodindev=1")
    : serverUri(`/api/get-diarization?test=1${isFast ? "&fast=1" : ""}`);
}

// Throws if upload is not finished.
async function checkUploadFinished(
  s3: S3Client,
  transcriptId: number,
  isFast: boolean,
  region: Region
): Promise<void> {
  const key = getUploadKey(transcriptId);

  await s3.send(
    new GetObjectCommand({
      Bucket: getTranscriptBucketNameByRegion(region),
      Key: key,
    })
  );

  await fetch(getUri(isFast), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET),
      Authorization: "Bearer " + assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET),
    },
    body: JSON.stringify({
      s3_audio_key: key,
    }),
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (isProd() || isPreview()) {
    return res.status(400).json({ error: "This endpoint is only available in development mode." });
  }

  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = JSON.parse(req.body);
  const transcriptId = body.transcriptId;
  const region = body.region;

  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  const fastPreviewEnabled = isDev();
  const now = Date.now();

  // Poll for 5 minutes
  while (Date.now() - now < 5 * 60 * 1000) {
    try {
      await checkUploadFinished(s3, transcriptId, fastPreviewEnabled, region);
      console.info("Dev-only polling found completed upload");
      break;
    } catch (err) {
      console.error("Dev-only polling failed to find completed upload, retrying...");
    } finally {
      // Wait 2 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return res.status(200).json({});
}

export default withErrorReporting(handler);
