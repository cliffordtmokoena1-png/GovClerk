import { Command } from "commander";
import { connect } from "@planetscale/database";
import { asUtcDate } from "@/utils/date";
import { assertString } from "@/utils/assert";
import { spawn } from "child_process";
import hubspot from "@/crm/hubspot";
import { getLeadFromDb } from "@/crm/leads";

type WhatsappRow = {
  id: number;
  created_at: Date;
  operator_email: string | null;
  sender: string | null;
  whatsapp_id: string;
  conversation_id: string;
  type: string;
  text: string | null;
  direction: string | null;
  user_id: string | null;
};

async function createTranscript(convo: WhatsappRow[], useColor: boolean = true): Promise<string> {
  let leadName = undefined;
  if (convo[0]?.user_id) {
    const lead = await getLeadFromDb(convo[0].user_id);
    leadName = lead?.firstName;
  }

  // ANSI color codes for timestamp and sender
  const colorTimestamp = useColor ? "\x1b[32m" : "";
  const colorSender = useColor ? "\x1b[35m" : "";
  const colorReset = useColor ? "\x1b[0m" : "";
  const timestampWidth = 9; // e.g. "[23:08 EDT]"
  const senderWidth = Math.max(...convo.map((row) => (row.sender ?? "Unknown").length));

  return convo
    .map((row) => {
      const timestamp = new Date(row.created_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/New_York",
        hour12: false,
        timeZoneName: "short",
      });
      const paddedTimestamp = `${colorTimestamp}[${timestamp}]${colorReset}`.padEnd(
        timestampWidth + 2 + colorTimestamp.length + colorReset.length
      ); // +2 for brackets

      let sender = `${colorSender}${(row.sender ?? "Unknown").padEnd(senderWidth)}${colorReset}`;
      if (row.direction === "inbound" && leadName) {
        sender = `${colorSender}${leadName.padEnd(senderWidth)}${colorReset}`;
      }

      const text = row.text?.trim() ?? "";
      return `${paddedTimestamp} ${sender}: ${text}`;
    })
    .join("\n");
}

function collateConversations(rows: WhatsappRow[]): Record<string, WhatsappRow[]> {
  const convos: Record<string, WhatsappRow[]> = {};
  for (const row of rows) {
    if (convos[row.conversation_id] == null) {
      convos[row.conversation_id] = [];
    }
    convos[row.conversation_id].push(row);
  }
  return convos;
}

async function run(
  dateOverride: string | undefined,
  usePager: boolean = false,
  useColor: boolean = true
): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const startDateCondition = dateOverride
    ? `w.created_at >= ?`
    : `w.created_at >= NOW() - INTERVAL 7 DAY`;

  const queryParams = dateOverride ? [dateOverride] : [];

  const rows = await conn
    .execute<WhatsappRow>(
      `
      SELECT
        w.id,
        w.created_at,
        w.operator_email,
        w.sender,
        w.whatsapp_id,
        w.conversation_id,
        w.type,
        w.text,
        w.direction,
        c.user_id 
      FROM gc_whatsapps w
      LEFT JOIN gc_whatsapp_contacts c ON w.whatsapp_id = c.whatsapp_id
      WHERE ${startDateCondition}
      ORDER BY w.created_at;
      `,
      queryParams
    )
    .then((result) =>
      result.rows.map((row: WhatsappRow) => ({
        ...row,
        created_at: asUtcDate(assertString(row.created_at)),
      }))
    );

  const convos = collateConversations(rows);

  // ANSI color codes
  const colorHeader = useColor ? "\x1b[36m" : ""; // cyan
  const colorSeparator = useColor ? "\x1b[33m" : ""; // yellow
  const colorReset = useColor ? "\x1b[0m" : "";

  let output = "";
  for (const [conversationId, convo] of Object.entries(convos)) {
    // Get the date the conversation started (first message)
    const startedAt = convo[0]?.created_at
      ? new Date(convo[0].created_at).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "Unknown";
    const transcript = await createTranscript(convo, useColor);
    output += `${colorHeader}Conversation ID: ${conversationId} (${startedAt})${colorReset}\n\n`;
    output += transcript + "\n\n";
    output += `${colorSeparator}${"=".repeat(40)}${colorReset}\n\n`;
  }

  if (usePager) {
    await openInPager(output);
  } else {
    process.stdout.write(output);
  }
}

function validateDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function openInPager(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pager = spawn("less", ["-R"], {
      stdio: ["pipe", "inherit", "inherit"],
    });

    // Handle EPIPE gracefully
    pager.stdin.on("error", (err) => {
      // @ts-ignore
      if (err.code === "EPIPE") {
        // Ignore EPIPE, pager was closed early
        resolve();
      } else {
        reject(err);
      }
    });

    pager.stdin.write(text);
    pager.stdin.end();

    pager.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Pager exited with code ${code}`));
      }
    });
  });
}

const program = new Command();
program
  .name("whatsapp")
  .description("Show WhatsApp conversations")
  .option("-d, --date <YYYY-MM-DD>", "Date to start processing from (defaults to 7 days ago)")
  .option("-p, --no-pager", "Disable pager and print output directly")
  .option("-c, --no-color", "Disable ANSI color codes in output")
  .parse(process.argv);

const options = program.opts<{ date?: string; pager?: boolean; color?: boolean }>();

if (options.date && !validateDate(options.date)) {
  console.error("❌ Invalid date format. Please use YYYY-MM-DD.");
  process.exit(1);
}

run(options.date, options.pager !== false, options.color !== false).catch((err) => {
  console.error("❌ Failed to log WhatsApp messages:", err);
  process.exit(1);
});
