import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4.1";
const RESPONSE_COLUMN = "native_gpt_41_response";

type CliOptions = {
  input: string;
  output?: string;
  limit?: number;
  model: string;
  delayMs: number;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

type HeaderIndexes = {
  commentType: number;
  postText: number;
  assetDescription: number;
  parentCommentAuthor: number;
  parentCommentText: number;
};

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"';
        i++;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      currentCell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: string[][]): string {
  return `${rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(",")).join("\n")}\n`;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function findHeaderIndex(headers: string[], snippets: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) =>
    snippets.some((snippet) => header.includes(snippet.toLowerCase()))
  );
}

function resolveHeaderIndexes(headers: string[]): HeaderIndexes {
  const commentType = findHeaderIndex(headers, ["comment type"]);
  const postText = findHeaderIndex(headers, ["post text"]);
  const assetDescription = findHeaderIndex(headers, ["asset description"]);
  const parentCommentAuthor = findHeaderIndex(headers, ["parent comment author"]);
  const parentCommentText = findHeaderIndex(headers, ["parent comment text"]);

  const missing: string[] = [];
  if (commentType === -1) missing.push("Comment Type");
  if (postText === -1) missing.push("Post Text");
  if (assetDescription === -1) missing.push("Asset Description");
  if (parentCommentAuthor === -1) missing.push("Parent Comment Author");
  if (parentCommentText === -1) missing.push("Parent Comment Text");

  if (missing.length > 0) {
    throw new Error(
      `Missing required CSV columns: ${missing.join(", ")}. ` +
        `Found headers: ${headers.map((h) => `"${h}"`).join(", ")}`
    );
  }

  return {
    commentType,
    postText,
    assetDescription,
    parentCommentAuthor,
    parentCommentText,
  };
}

function getCell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function buildPrompt(row: string[], indexes: HeaderIndexes): string {
  const commentTypeRaw = getCell(row, indexes.commentType).toLowerCase();
  const postText = getCell(row, indexes.postText);
  const assetDescription =
    getCell(row, indexes.assetDescription) || "No asset description provided.";
  const parentCommentAuthor = getCell(row, indexes.parentCommentAuthor) || "Unknown author";
  const parentCommentText = getCell(row, indexes.parentCommentText);

  if (!postText) {
    throw new Error("Post Text is empty");
  }

  if (commentTypeRaw === "reply") {
    return `Write a reply comment in my own voice that is 1-2 sentences.

The reply is to this parent comment by ${parentCommentAuthor}:

${parentCommentText}

The original post has this content:

${postText}

and has an accompanying asset with this description:

${assetDescription}

Return only the reply comment text.`;
  }

  return `Write a comment in my own voice that is 1-2 sentences.

The comment is on a post with this content:

${postText}

and has an accompanying asset with this description:

${assetDescription}

Return only the comment text.`;
}

function getContentFromResponse(data: OpenRouterResponse): string {
  const content = data.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return part.text ?? "";
      })
      .join("")
      .trim();

    if (joined) {
      return joined;
    }
  }

  throw new Error("OpenRouter response did not include a text completion");
}

async function callOpenRouter(prompt: string, model: string, apiKey: string): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://GovClerkMinutes.com",
      "X-Title": "GovClerkMinutes",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return getContentFromResponse(data);
}

function defaultOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);
  const ext = parsed.ext || ".csv";
  return path.join(parsed.dir, `${parsed.name}.native_gpt_41${ext}`);
}

function parsePositiveIntegerOption(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be an integer greater than 0`);
  }
  return parsed;
}

function parseNonNegativeIntegerOption(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${optionName} must be an integer greater than or equal to 0`);
  }
  return parsed;
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(options: CliOptions): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Run with .env loaded.");
  }

  const inputContent = await readFile(options.input, "utf8");
  const rows = parseCsv(inputContent.replace(/^\uFEFF/, ""));

  if (rows.length === 0) {
    throw new Error("Input CSV is empty");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const headerIndexes = resolveHeaderIndexes(headers);

  let responseColumnIndex = headers.findIndex(
    (header) => normalizeHeader(header) === RESPONSE_COLUMN
  );

  if (responseColumnIndex === -1) {
    headers.push(RESPONSE_COLUMN);
    responseColumnIndex = headers.length - 1;
  }

  for (const row of dataRows) {
    while (row.length < headers.length) {
      row.push("");
    }
  }

  const candidates = dataRows
    .map((row, i) => ({ row, rowNumber: i + 2 }))
    .filter(({ row }) => !isRowEmpty(row));

  const limit = options.limit ?? candidates.length;
  const toProcess = candidates.slice(0, limit);

  console.log(
    `Processing ${toProcess.length} row(s) out of ${candidates.length} non-empty row(s) with model ${options.model}`
  );

  for (let i = 0; i < toProcess.length; i++) {
    const { row, rowNumber } = toProcess[i];
    const commentType = getCell(row, headerIndexes.commentType) || "Post";
    console.log(`[${i + 1}/${toProcess.length}] Row ${rowNumber} (${commentType})`);

    try {
      const prompt = buildPrompt(row, headerIndexes);
      const response = await callOpenRouter(prompt, options.model, apiKey);
      row[responseColumnIndex] = response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      row[responseColumnIndex] = `ERROR: ${message}`;
      console.error(`Row ${rowNumber} failed: ${message}`);
    }

    if (options.delayMs > 0 && i < toProcess.length - 1) {
      await sleep(options.delayMs);
    }
  }

  const outputPath = options.output ?? defaultOutputPath(options.input);
  await writeFile(outputPath, toCsv(rows), "utf8");
  console.log(`Wrote output CSV to ${outputPath}`);
}

const program = new Command();

program
  .name("nativeGpt41Csv")
  .description("Generate native GPT-4.1 comment completions for rows in a CSV via OpenRouter")
  .requiredOption("-i, --input <path>", "Input CSV path")
  .option("-o, --output <path>", "Output CSV path (default: <input>.native_gpt_41.csv)")
  .option(
    "-l, --limit <count>",
    "Only process the first N non-empty rows (useful for low-cost testing)",
    (value) => parsePositiveIntegerOption(value, "--limit")
  )
  .option("-m, --model <model>", "OpenRouter model name", DEFAULT_MODEL)
  .option(
    "--delay-ms <ms>",
    "Delay between API calls in milliseconds",
    (value) => parseNonNegativeIntegerOption(value, "--delay-ms"),
    0
  )
  .action(async (opts: CliOptions) => {
    await run(opts);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
