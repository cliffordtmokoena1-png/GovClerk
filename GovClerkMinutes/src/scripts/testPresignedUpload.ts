// Script: Test S3 presigned URL upload using the same bucket/region as WhatsApp audio.
// Usage:
//   npm run s3:test-upload -- --file ./path/to/file --key optional/custom/key
//
// Notes:
// - This uses the same bucket and region as the WhatsApp audio codepath: GovClerkMinuteswhatsapp (us-east-2).
// - Requires AWS_WHATSAPP_ACCESS_KEY and AWS_WHATSAPP_ACCESS_KEY_SECRET in your .env

import { Command } from "commander";
import path from "node:path";
import fs from "node:fs/promises";

import get_presigned_url from "@/s3/get_presigned_url";
import { assertString } from "@/utils/assert";
import type { BucketName, Region } from "@/utils/s3";

type CliOptions = {
  file: string;
  key?: string;
  bucket: BucketName;
  region: Region;
  expires: number;
};

async function main() {
  const program = new Command();
  program
    .name("test-presigned-upload")
    .description(
      "Upload a local file to S3 using a presigned URL (GovClerkMinuteswhatsapp / us-east-2)."
    )
    .requiredOption("-f, --file <path>", "Path to a local file to upload")
    .option("-k, --key <s3-key>", "S3 object key to use (defaults to test/<timestamp>-<filename>)")
    .option("-b, --bucket <bucket>", "S3 bucket name", "GovClerkMinuteswhatsapp")
    .option("-r, --region <region>", "AWS region", "us-east-2")
    .option(
      "-e, --expires <seconds>",
      "Expiry seconds for the presigned URL",
      (v) => Number(v),
      600
    );

  program.parse(process.argv);
  const opts = program.opts<CliOptions>();

  const filePath = path.resolve(process.cwd(), opts.file);
  const fileBuffer = await fs.readFile(filePath);

  const fileName = path.basename(filePath);
  const defaultKey = `test/${Date.now()}-${fileName}`;
  const key = opts.key ?? defaultKey;

  // Validate env vars
  const accessKeyId = assertString(process.env.AWS_WHATSAPP_ACCESS_KEY);
  const secretAccessKey = assertString(process.env.AWS_WHATSAPP_ACCESS_KEY_SECRET);

  const { presignedUrl, key: usedKey } = await get_presigned_url({
    key,
    bucket: opts.bucket as BucketName,
    region: opts.region as Region,
    method: "PUT",
    expiresInSecs: Number(opts.expires),
    accessKeyId,
    secretAccessKey,
  });

  // Upload via fetch PUT
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: new Blob([new Uint8Array(fileBuffer)]),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "<no response body>");
    throw new Error(`Upload failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const objectUrl = `https://${opts.bucket}.s3.${opts.region}.amazonaws.com/${usedKey}`;

  console.log("Upload successful");
  console.log("S3 Key:", usedKey);
  console.log("S3 URL (may require auth):", objectUrl);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
