import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parseISO, isValid, format } from "date-fns";
import { connect } from "@planetscale/database";
import { getTranscript } from "@/scripts/utils/transcript";
import { assertString } from "@/utils/assert";

interface Classification {
  jobTitle?: string;
  orgType?: string;
  reason?: string;
}

function getPrompt(transcript: string): string {
  return `The following is a transcript of a meeting. Someone will write meeting minutes for this meeting. Respond with a JSON object containing the following fields:
1. orgType: The type of organization the meeting is for.
2. reason: A 1 sentence description of why you chose the above value.

If you cannot determine a field, use null.

These values should map to Google search keywords. We are trying to distill search keywords from the transcript contents.

Here is the transcript:

${transcript}`;
}

async function callLlm(transcript: string): Promise<Classification> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${assertString(process.env.OPENROUTER_API_KEY)}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: getPrompt(transcript),
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meeting_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              jobTitle: { type: "string", nullable: true },
              orgType: { type: "string", nullable: true },
              reason: { type: "string" },
            },
            required: [],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to call OpenRouter API: ${response.statusText}`);
  }
  const data = await response.json();
  console.log(JSON.stringify(data));

  const classification: Classification = JSON.parse(data.choices[0].message.content);

  console.log(JSON.stringify(classification, null, 2));
  return classification;
}

async function classify(transcriptId: number): Promise<void> {
  const transcript = await getTranscript(transcriptId);
  if (!transcript) {
    throw new Error(`Transcript with ID ${transcriptId} not found`);
  }
  await callLlm(transcript);
}

async function classifyTranscripts(date: string): Promise<void> {
  console.log(`Pulling transcripts from ${date}`);

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute<{ id: number }>(
      `
      SELECT id
      FROM transcripts
      WHERE DATE(dateCreated) = ?
      AND transcribe_finished = 1;
      `,
      [date]
    )
    .then((res) => res.rows);

  for (const row of rows) {
    try {
      await classify(row.id);
    } catch (err) {
      console.error(`Error classifying transcript ${row.id}: ${(err as Error).message}`);
      continue;
    }
    return;
  }
}

/**
 * Guard‑rail to make sure the user supplied a valid YYYY‑MM‑DD string.
 */
function checkValidDate(input: string): string {
  const date = parseISO(input);
  if (!isValid(date) || input.length !== 10) {
    throw new Error(`\n  ❌  \"${input}\" is not a valid MySQL date (YYYY-MM-DD).`);
  }
  return format(date, "yyyy-MM-dd");
}

async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("classifyTranscripts")
    .usage("$0 <date>", "Classify transcripts uploaded on a given date", (y) =>
      y.positional("date", {
        describe: "Date in YYYY-MM-DD format (MySQL-compatible)",
        type: "string",
        demandOption: true,
      })
    )
    .strict()
    .help()
    .parse();

  try {
    const date = checkValidDate(argv.date as string);
    await classifyTranscripts(date);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

main();
