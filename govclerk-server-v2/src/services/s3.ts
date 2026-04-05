import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

const DEFAULT_BUCKET = process.env.AWS_S3_BUCKET ?? 'govclerk-bucket';

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
 * Generates a 6-hour presigned URL for an S3 object.
 * Used to give AssemblyAI temporary access to the audio file.
 * 6 hours (21600 s) is used so that large files (2+ hour recordings)
 * are still accessible even if AssemblyAI queues before downloading.
 */
export async function getSignedAudioUrl(s3Key: string, region: string): Promise<string> {
  const client = getS3Client(region);
  const command = new GetObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: s3Key,
  });
  return getSignedUrl(client, command, { expiresIn: 21600 });
}

/**
 * Downloads an S3 object and returns its content as a Buffer along with the ContentType.
 * Used to inspect the file before deciding how to process it (e.g. WebM detection).
 */
export async function downloadS3Object(s3Key: string, region: string): Promise<{ buffer: Buffer; contentType?: string }> {
  const client = getS3Client(region);
  const command = new GetObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: s3Key,
  });
  const response = await client.send(command);
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType,
  };
}