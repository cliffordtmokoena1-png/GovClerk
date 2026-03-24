import { Command } from "commander";
import fs from "fs/promises";
import { execSync } from "child_process";
import path from "path";

// Ensure gcloud CLI is available and conda env is activated
function checkGcloud() {
  try {
    execSync("gcloud --version", { stdio: "ignore" });
  } catch (err) {
    console.error("gcloud CLI not found. Please run: conda activate gcloud");
    process.exit(1);
  }
}

const LOCATION = "global";
const MODEL = "long";
const LANGUAGE_CODE = "tn-Latn-ZA";
// const LANGUAGE_CODE = "ts-ZA";

async function main(gcsUri: string) {
  checkGcloud();
  // Get project ID and access token using gcloud CLI
  const projectId = execSync("gcloud config get-value project", { encoding: "utf8" }).trim();
  const accessToken = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();

  // Build request payload
  const payload = {
    config: {
      auto_decoding_config: {},
      language_codes: [LANGUAGE_CODE],
      model: MODEL,
    },
    files: [{ uri: gcsUri }],
    recognition_output_config: {
      inline_response_config: {},
    },
  };

  // Write payload to a temp file (for debugging, optional)
  const tmpPath = path.join("/tmp", `stt_v2_request_${Date.now()}.json`);
  await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");

  // Make the POST request
  const url = `https://speech.googleapis.com/v2/projects/${projectId}/locations/${LOCATION}/recognizers/_:batchRecognize`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Google Speech API responded with ${resp.status}: ${text}`);
    process.exit(2);
  }

  const data = await resp.json();
  // Extract operation name for polling
  const opName = data.name;
  if (!opName) {
    console.error("No operation name returned from initial request.");
    process.exit(2);
  }
  const pollUrl = `https://speech.googleapis.com/v2/${opName}`;

  // Poll for result
  let pollCount = 0;
  let result;
  while (true) {
    pollCount++;
    const pollResp = await fetch(pollUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!pollResp.ok) {
      const text = await pollResp.text();
      console.error(`Polling failed (${pollResp.status}): ${text}`);
      process.exit(2);
    }
    const pollData = await pollResp.json();
    if (pollData.done) {
      result = pollData;
      break;
    }
    console.log(`Polling attempt ${pollCount}: not done yet...`);
    await new Promise((resolve) => setTimeout(resolve, 15000)); // 15s
  }

  console.log(result);
  const outputPath = `${new Date().toISOString()}.google_speech_response.json`;
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote response to ${outputPath}`);
}

const program = new Command();
program
  .name("google:speech")
  .description("Send a GCS URI to Google Speech-to-Text v2 BatchRecognize API")
  .argument("<gcsUri>", "GCS URI of the audio file (e.g. gs://bucket/file.m4a)")
  .action((gcsUri) => {
    main(gcsUri);
  });

program.parse(process.argv);
