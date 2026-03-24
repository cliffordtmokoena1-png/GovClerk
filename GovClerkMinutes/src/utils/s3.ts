import { isDev } from "./dev";
import { Env } from "./price";

export const DEFAULT_REGION: Region = (process.env.AWS_REGION as Region) || "us-east-2";

export function extractRegionFromS3Url(s3Url: string): Region | null {
  const match = s3Url.match(/\.s3[.-]([a-z0-9-]+)\.amazonaws\.com/);
  if (match) {
    const region = match[1];
    if (region === "us-east-2" || region === "eu-central-1") {
      return region;
    }
  }
  return null;
}

export function getUploadKey(transcriptId: number, options?: { env?: Env }): string {
  const env = options?.env;
  const testPrefix = env === "dev" || (env === undefined && isDev()) ? "test_" : "";
  return `${testPrefix}uploads/upload_${transcriptId}`;
}

export type Region = "us-east-2" | "eu-central-1";
export type BucketName =
  | "govclerk-audio-uploads"
  | "GovClerkMinutesfrankfurt"
  | "GovClerkMinuteswhatsapp";

export function getTranscriptBucketNameByRegion(region: Region | null | undefined): BucketName {
  if (region == null || region === "us-east-2") {
    return "govclerk-audio-uploads";
  } else {
    return "GovClerkMinutesfrankfurt";
  }
}

export function assertRegion(region: string | null | undefined): Region {
  if (region !== "us-east-2" && region !== "eu-central-1") {
    throw new Error(`Invalid region: ${region}`);
  }
  return region;
}
