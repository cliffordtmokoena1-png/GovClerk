import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "node:stream";
import { assertString } from "../../../src/utils/assert.ts";

let s3: S3Client | null = null;

function getS3(): S3Client {
  if (s3) {
    return s3;
  }

  s3 = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
  });

  return s3;
}

export async function putObject(args: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
}): Promise<void> {
  const client = getS3();
  await client.send(
    new PutObjectCommand({
      Bucket: "govclerk-bucket",
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
    })
  );
}

export function createStreamingUpload(args: { key: string; contentType: string }): {
  passThrough: PassThrough;
  upload: Upload;
  promise: Promise<void>;
} {
  const client = getS3();
  const passThrough = new PassThrough();

  const upload = new Upload({
    client,
    params: {
      Bucket: "govclerk-bucket",
      Key: args.key,
      Body: passThrough,
      ContentType: args.contentType,
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024, // 5MB minimum
    leavePartsOnError: false,
  });

  const promise = upload.done().then(() => {});
  return { passThrough, upload, promise };
}
