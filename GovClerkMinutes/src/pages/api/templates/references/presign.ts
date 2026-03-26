import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { Hash } from "@aws-sdk/hash-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { HttpRequest } from "@smithy/protocol-http";
import path from "node:path";

import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, type Region, assertRegion } from "@/utils/s3";
import { PRESIGNED_URL_TTL } from "@/common/constants";

type PresignRequestFile = {
  name: string;
  type?: string | null;
  size: number;
};

type PresignRequestBody = {
  templateId?: string;
  files?: PresignRequestFile[];
  region?: Region | null;
};

type PresignResponseReference = {
  key: string;
  uploadUrl: string;
  contentType: string;
  sampleNumber: number;
  fileName: string;
};

type PresignResponseBody = {
  templateId: string;
  region: Region;
  references: PresignResponseReference[];
};

const DEFAULT_REGION: Region = "us-east-1";

function ensureTemplateId(candidate?: string): string {
  if (candidate?.startsWith("custom-")) {
    return candidate;
  }
  throw new Error("templateId must be provided and start with 'custom-' prefix");
}

function ensureFiles(files?: PresignRequestFile[]): PresignRequestFile[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("At least one file is required");
  }
  if (files.length > 10) {
    throw new Error("A maximum of 10 files is allowed");
  }
  return files;
}

function resolveExtension(file: PresignRequestFile): string {
  const extFromName = path.extname(file.name ?? "").toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  const typeMapping: Record<string, string> = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };

  if (file.type && typeMapping[file.type]) {
    return typeMapping[file.type];
  }

  return "";
}

async function presignHandler(
  req: NextApiRequest,
  res: NextApiResponse<PresignResponseBody | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = (
    typeof req.body === "string" ? JSON.parse(req.body) : req.body
  ) as PresignRequestBody;

  let templateId: string;
  let region: Region;
  let files: PresignRequestFile[];

  try {
    templateId = ensureTemplateId(body.templateId);
    region = body.region ? assertRegion(body.region) : DEFAULT_REGION;
    files = ensureFiles(body.files);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return res.status(400).json({ error: message });
  }

  const bucket = getTranscriptBucketNameByRegion(region);
  const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;
  const presigner = new S3RequestPresigner({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
    sha256: Hash.bind(null, "sha256"),
  });

  const references: PresignResponseReference[] = [];

  await Promise.all(
    files.map(async (file, index) => {
      const extension = resolveExtension(file);
      const sampleNumber = index + 1;
      const key = `template/${templateId}-sample_${sampleNumber}${extension}`;
      const contentType = file.type ?? "application/octet-stream";

      const uploadRequest = await presigner.presign(
        new HttpRequest({
          protocol: "https",
          hostname: bucketHost,
          method: "PUT",
          path: `/${key}`,
          headers: {
            host: bucketHost,
            "content-type": contentType,
          },
        }),
        { expiresIn: PRESIGNED_URL_TTL }
      );

      const uploadUrl = formatUrl(uploadRequest);

      references.push({
        key,
        uploadUrl,
        contentType,
        sampleNumber,
        fileName: file.name,
      });
    })
  );

  references.sort((a, b) => a.sampleNumber - b.sampleNumber);

  return res.status(200).json({ templateId, region, references });
}

export default withErrorReporting(presignHandler);
