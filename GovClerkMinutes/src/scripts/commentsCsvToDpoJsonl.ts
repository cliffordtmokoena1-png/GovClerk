import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CliOptions = {
  input: string;
  output?: string;
  limit?: number;
};

type HeaderIndexes = {
  commentType: number;
  manualComment: number;
  postText: number;
  assetDescription: number;
  parentCommentAuthor: number;
  parentCommentText: number;
  nativeGpt41Response: number;
};

type DpoExample = {
  input: {
    messages: Array<{
      role: "user";
      content: string;
    }>;
    tools: [];
    parallel_tool_calls: true;
  };
  preferred_output: Array<{
    role: "assistant";
    content: string;
  }>;
  non_preferred_output: Array<{
    role: "assistant";
    content: string;
  }>;
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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function getCell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

function findHeaderIndex(headers: string[], snippets: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) =>
    snippets.some((snippet) => header.includes(snippet.toLowerCase()))
  );
}

function resolveHeaderIndexes(headers: string[]): HeaderIndexes {
  const commentType = findHeaderIndex(headers, ["comment type"]);
  const manualComment = findHeaderIndex(headers, ["your comment text"]);
  const postText = findHeaderIndex(headers, ["post text"]);
  const assetDescription = findHeaderIndex(headers, ["asset description"]);
  const parentCommentAuthor = findHeaderIndex(headers, ["parent comment author"]);
  const parentCommentText = findHeaderIndex(headers, ["parent comment text"]);
  const nativeGpt41Response = findHeaderIndex(headers, ["native_gpt_41_response"]);

  const missing: string[] = [];
  if (commentType === -1) missing.push("Comment Type");
  if (manualComment === -1) missing.push("Your Comment Text");
  if (postText === -1) missing.push("Post Text");
  if (assetDescription === -1) missing.push("Asset Description");
  if (parentCommentAuthor === -1) missing.push("Parent Comment Author");
  if (parentCommentText === -1) missing.push("Parent Comment Text");
  if (nativeGpt41Response === -1) missing.push("native_gpt_41_response");

  if (missing.length > 0) {
    throw new Error(
      `Missing required CSV columns: ${missing.join(", ")}. ` +
        `Found headers: ${headers.map((h) => `"${h}"`).join(", ")}`
    );
  }

  return {
    commentType,
    manualComment,
    postText,
    assetDescription,
    parentCommentAuthor,
    parentCommentText,
    nativeGpt41Response,
  };
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

function buildDpoExample(
  row: string[],
  indexes: HeaderIndexes,
  rowNumber: number
): DpoExample | null {
  const preferred = getCell(row, indexes.manualComment);
  const nonPreferred = getCell(row, indexes.nativeGpt41Response);

  if (!preferred || !nonPreferred) {
    console.warn(
      `Skipping row ${rowNumber}: missing ${!preferred ? "manual comment" : "native_gpt_41_response"}`
    );
    return null;
  }

  const prompt = buildPrompt(row, indexes);

  return {
    input: {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      tools: [],
      parallel_tool_calls: true,
    },
    preferred_output: [
      {
        role: "assistant",
        content: preferred,
      },
    ],
    non_preferred_output: [
      {
        role: "assistant",
        content: nonPreferred,
      },
    ],
  };
}

function defaultOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.dpo.jsonl`);
}

function parsePositiveIntegerOption(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be an integer greater than 0`);
  }
  return parsed;
}

async function run(options: CliOptions): Promise<void> {
  const csvContent = await readFile(options.input, "utf8");
  const rows = parseCsv(csvContent.replace(/^\uFEFF/, ""));

  if (rows.length === 0) {
    throw new Error("Input CSV is empty");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const indexes = resolveHeaderIndexes(headers);

  const candidates = dataRows
    .map((row, i) => ({ row, rowNumber: i + 2 }))
    .filter(({ row }) => !isRowEmpty(row));

  const limit = options.limit ?? candidates.length;
  const selected = candidates.slice(0, limit);

  console.log(`Building DPO JSONL from ${selected.length} row(s)`);

  const examples: DpoExample[] = [];
  for (const { row, rowNumber } of selected) {
    try {
      const example = buildDpoExample(row, indexes, rowNumber);
      if (example) {
        examples.push(example);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping row ${rowNumber}: ${message}`);
    }
  }

  const outputPath = options.output ?? defaultOutputPath(options.input);
  const jsonl = examples.map((example) => JSON.stringify(example)).join("\n");
  await writeFile(outputPath, `${jsonl}${jsonl ? "\n" : ""}`, "utf8");

  console.log(`Wrote ${examples.length} DPO example(s) to ${outputPath}`);
}

const program = new Command();

program
  .name("commentsCsvToDpoJsonl")
  .description("Convert comments CSV with native GPT-4.1 responses into OpenAI DPO JSONL format")
  .requiredOption("-i, --input <path>", "Input CSV path")
  .option("-o, --output <path>", "Output JSONL path (default: <input>.dpo.jsonl)")
  .option("-l, --limit <count>", "Only convert the first N non-empty rows", (value) =>
    parsePositiveIntegerOption(value, "--limit")
  )
  .action(async (opts: CliOptions) => {
    await run(opts);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
