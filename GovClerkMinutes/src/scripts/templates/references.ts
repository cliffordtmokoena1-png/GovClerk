import { Command } from "commander";
import path from "path";
import fs from "fs/promises";

import { assertString } from "@/utils/assert";
import { getTranscriptBucketNameByRegion, type Region } from "@/utils/s3";
import { Template } from "@/types/Template";
import { connect } from "@planetscale/database";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import "@/scripts/loadenv";

type ReferenceKeysRow = {
  reference_s3_keys: string | null;
  template_id: string;
  name: string;
};

const program = new Command();

program
  .name("template:references")
  .description("Download stored template reference files for a given template")
  .argument("<template_id>", "Template ID (custom-*)")
  .option("--region <region>", "AWS region override", "us-east-2")
  .option(
    "--output <directory>",
    "Directory to save files to",
    path.resolve(process.cwd(), "tmp/template-references")
  )
  .action(async (templateId: string, options) => {
    if (!templateId.startsWith("custom-")) {
      throw new Error("template_id must start with custom-");
    }

    const region = options.region as Region;
    const outputDir = options.output as string;

    const conn = connect({
      host: assertString(process.env.PLANETSCALE_DB_HOST),
      username: assertString(process.env.PLANETSCALE_DB_USERNAME),
      password: assertString(process.env.PLANETSCALE_DB_PASSWORD),
    });

    const results = await conn.execute<ReferenceKeysRow>(
      `SELECT template_id, name, reference_s3_keys
       FROM gc_templating
       WHERE template_id = ?
       LIMIT 1`,
      [templateId]
    );

    if (results.rows.length === 0) {
      throw new Error(`Template ${templateId} not found`);
    }

    const row = results.rows[0];
    const referenceKeysRaw = row.reference_s3_keys;
    if (!referenceKeysRaw) {
      console.log(`Template ${templateId} has no stored references.`);
      return;
    }

    const keys: string[] = JSON.parse(referenceKeysRaw);
    if (keys.length === 0) {
      console.log(`Template ${templateId} has no stored references.`);
      return;
    }

    await fs.mkdir(outputDir, { recursive: true });

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
        secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
      },
    });

    const bucket = getTranscriptBucketNameByRegion(region);

    let downloaded = 0;
    for (const key of keys) {
      const fileName = key.split("/").pop() ?? key.replace(/\//g, "_");
      const outputPath = path.join(outputDir, fileName);

      console.log(`Downloading ${key} -> ${outputPath}`);
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3.send(command);
      const body = response.Body;
      if (!body) {
        console.warn(`Skipping ${key} (empty body)`);
        continue;
      }

      const stream = body as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      await fs.writeFile(outputPath, Buffer.concat(chunks));
      downloaded += 1;
    }

    console.log(`Downloaded ${downloaded}/${keys.length} reference files for ${templateId}`);
  });

program.parseAsync();
