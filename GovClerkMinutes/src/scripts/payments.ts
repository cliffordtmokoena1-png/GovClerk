import { assertString } from "@/utils/assert";
import { connect } from "@planetscale/database";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });

async function getPayments(userId: string): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const res = await conn.execute(
    "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  if (!res.rows || res.rows.length === 0) {
    console.log(`No payment records found for user ${userId}`);
    return;
  }

  const excludeColumns = ["user_id", "mode", "checkout_session_id"];

  const headers = Object.keys(res.rows[0]).filter((header) => !excludeColumns.includes(header));

  let csvContent = headers.join(",") + "\n";

  res.rows.forEach((row) => {
    csvContent +=
      headers
        .map((header) => {
          const value = row[header] !== null ? String(row[header]) : "";
          return value.includes(",") ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",") + "\n";
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = path.join(process.cwd(), `payments_${userId}_${timestamp}.csv`);

  fs.writeFileSync(filename, csvContent);

  console.log(`Payment records for user ${userId} saved to ${filename}`);
  console.log(`Total records: ${res.rows.length}`);
}

yargs(hideBin(process.argv))
  .command(
    "$0 <user_id>",
    "Query payment records for a user",
    (yargs) => {
      return yargs.positional("user_id", {
        describe: "The user ID to query payments for",
        type: "string",
      });
    },
    async (argv) => {
      await getPayments(assertString(argv.user_id));
    }
  )
  .help()
  .alias("help", "h")
  .strict()
  .parse();
