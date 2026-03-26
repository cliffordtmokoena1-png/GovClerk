import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import {
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionCommand,
  PublishVersionCommand,
} from "@aws-sdk/client-lambda";
import { assertString } from "@/utils/assert";

dotenv.config({ path: ".env" });

const FUNCTION_NAME = "onMgUploadDone";
const ZIPPED_BUNDLE_PATH = resolve(__dirname, "..", "..", "build", "index.js.zip");

async function waitForUpdateCompletion(lambda: LambdaClient, functionName: string) {
  while (true) {
    const { Configuration } = await lambda.send(
      new GetFunctionCommand({ FunctionName: functionName })
    );
    const status = Configuration?.LastUpdateStatus;
    if (status === "Successful") {
      console.log("Update completed successfully.");
      break;
    } else if (status === "Failed") {
      throw new Error("Lambda update failed.");
    } else {
      console.log(`[${status}] Update in progress, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function deployForRegion(region: string) {
  const lambda = new LambdaClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_LAMBDA_EDITOR_ACCESS_KEY!,
      secretAccessKey: process.env.AWS_LAMBDA_EDITOR_ACCESS_KEY_SECRET!,
    },
  });

  try {
    const zipBuffer = readFileSync(ZIPPED_BUNDLE_PATH);

    await lambda.send(
      new UpdateFunctionCodeCommand({
        FunctionName: FUNCTION_NAME,
        ZipFile: new Uint8Array(zipBuffer),
      })
    );

    console.log(`Lambda function code updated for ${region}!`);

    await waitForUpdateCompletion(lambda, FUNCTION_NAME);

    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: FUNCTION_NAME,
        Environment: {
          Variables: {
            UPLOAD_COMPLETE_WEBHOOK_SECRET: assertString(
              process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET
            ),
            NEXT_PUBLIC_POSTHOG_KEY: assertString(process.env.NEXT_PUBLIC_POSTHOG_KEY),
            NEXT_PUBLIC_POSTHOG_HOST: assertString(process.env.NEXT_PUBLIC_POSTHOG_HOST),
            PLANETSCALE_DB_HOST: assertString(process.env.PLANETSCALE_DB_HOST),
            PLANETSCALE_DB_USERNAME: assertString(process.env.PLANETSCALE_DB_USERNAME),
            PLANETSCALE_DB_PASSWORD: assertString(process.env.PLANETSCALE_DB_PASSWORD),
          },
        },
      })
    );

    console.log("Lambda environment variables updated!");

    await waitForUpdateCompletion(lambda, FUNCTION_NAME);

    const publishVersionResponse = await lambda.send(
      new PublishVersionCommand({ FunctionName: FUNCTION_NAME })
    );

    console.log("✅ Lambda version published:", publishVersionResponse.Version);
  } catch (err) {
    console.error("Error deploying Lambda:", err);
  }
}

async function main() {
  await deployForRegion("us-east-1");
  await deployForRegion("eu-central-1");
}

main();
