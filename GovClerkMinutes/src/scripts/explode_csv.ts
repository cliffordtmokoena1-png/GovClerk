import { Command } from "commander";
import { readFile } from "node:fs/promises";

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

  // Push trailing cell/row for non-empty files that do not end in newline.
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function formatRows(rows: string[][]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows
    .map((row, rowIndex) => {
      const columns = row
        .map((cell, columnIndex) => {
          const header = headers[columnIndex] ?? `Column ${columnIndex + 1}`;
          return `${header}:\n${cell}`;
        })
        .join("\n\n");

      return `ROW ${rowIndex + 1}:\n${columns}`;
    })
    .join("\n\n");
}

async function run(csvFile: string): Promise<void> {
  const csvContent = await readFile(csvFile, "utf8");
  const normalized = csvContent.replace(/^\uFEFF/, "");
  const rows = parseCsv(normalized);

  process.stdout.write(`${formatRows(rows)}\n`);
}

const program = new Command();

program
  .name("explode_csv")
  .description(
    "Print CSV rows to stdout with each cell prefixed by its column number (Column 1, Column 2, ...)"
  )
  .argument("<csvFile>", "Path to the CSV file to explode")
  .action(async (csvFile: string) => {
    try {
      await run(csvFile);
    } catch (err) {
      console.error("❌ Failed to explode CSV:", err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error("❌ CLI crashed:", err);
  process.exit(1);
});
