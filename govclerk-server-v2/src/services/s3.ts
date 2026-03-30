import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEFAULT_BUCKET = process.env.AWS_S3_BUCKET ?? 'govclerk-uploads';

function getS3Client(region: string): S3Client {
  return new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Generates a 1-hour presigned URL for an S3 object.
 * Used to give AssemblyAI temporary access to the audio file.
 */
export async function getSignedAudioUrl(s3Key: string, region: string): Promise<string> {
  const client = getS3Client(region);
  const command = new GetObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: s3Key,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}
