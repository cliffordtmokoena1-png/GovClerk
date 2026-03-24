import { assertNumber, assertString } from "@/utils/assert";
import { connect } from "@planetscale/database";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

dotenv.config({ path: ".env" });

async function token(id: string, amount: number): Promise<void> {
  const isOrg = id.startsWith("org_");
  const isUser = id.startsWith("user_");

  if (!isOrg && !isUser) {
    throw new Error(`Invalid ID: ${id}. Must start with 'org_' or 'user_'`);
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  let res;
  if (isOrg) {
    res = await conn.execute(
      "INSERT INTO payments (user_id, org_id, credit, action, billing_subject) VALUES (NULL, ?, ?, 'script', 'org');",
      [id, amount]
    );
    console.log(`Credited org ${id} with amount ${amount} tokens!\n\n(id: ${res.insertId})`);
  } else {
    res = await conn.execute(
      "INSERT INTO payments (user_id, credit, action) VALUES (?, ?, 'script');",
      [id, amount]
    );
    console.log(`Credited user ${id} with amount ${amount} tokens!\n\n(id: ${res.insertId})`);
  }
}

yargs(hideBin(process.argv))
  .command(
    "add <id> <amount>",
    "Add tokens to an org or user account",
    (yargs) => {
      return yargs
        .positional("id", {
          describe: "The org or user ID to token (must start with 'org_' or 'user_')",
          type: "string",
        })
        .positional("amount", {
          describe: "The amount to token",
          type: "number",
        });
    },
    async (argv) => {
      await token(assertString(argv.id), assertNumber(argv.amount));
    }
  )
  .command(
    "sub <id> <amount>",
    "Deduct tokens from an org or user account",
    (yargs) => {
      return yargs
        .positional("id", {
          describe:
            "The org or user ID from which to deduct tokens (must start with 'org_' or 'user_')",
          type: "string",
        })
        .positional("amount", {
          describe: "The amount of tokens to deduct (positive number)",
          type: "number",
        });
    },
    async (argv) => {
      await token(assertString(argv.id), -assertNumber(argv.amount));
    }
  )
  .help()
  .alias("help", "h")
  .demandCommand(1, "You need at least one command before moving on")
  .strict()
  .parse();
