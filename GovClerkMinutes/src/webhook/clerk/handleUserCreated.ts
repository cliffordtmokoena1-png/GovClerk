import { createClerkClient } from "@clerk/nextjs/server";
import { upsertLeadToDb } from "@/crm/leads";
import { insertTemplateTranscript } from "@/templates/templates";
import { getClerkKeys } from "@/utils/clerk";
import { capture } from "@/utils/posthog";
import { sendWelcomeEmail } from "@/utils/postmark";
import type { Site } from "@/utils/site";
import { UserJSON } from "@clerk/nextjs/dist/types/server";
import { connect } from "@planetscale/database";

function isActionColumnMissing(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const e = error as { errno?: number; message?: string };
  return (
    e.errno === 1054 ||
    (typeof e.message === "string" &&
      (e.message.includes("1054") || e.message.includes("Unknown column")))
  );
}

async function insertTrialTokens(conn: ReturnType<typeof connect>, userId: string): Promise<void> {
  try {
    await conn.execute('INSERT INTO payments (user_id, credit, action) VALUES (?, 30, "add");', [
      userId,
    ]);
  } catch (insertErr) {
    // Fallback for DB branches that don't have the 'action' column (MySQL errno 1054).
    if (isActionColumnMissing(insertErr)) {
      console.warn("[handleUserCreated] 'action' column not found, retrying without it");
      await conn.execute("INSERT INTO payments (user_id, credit) VALUES (?, 30);", [userId]);
    } else {
      throw insertErr;
    }
  }
}

export async function handleUserCreated(body: UserJSON, site: Site): Promise<void> {
  const userId = body.id;

  const clerkClient = createClerkClient(getClerkKeys(site));
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      isEnterprise: true,
    },
  });

  const email = body.email_addresses?.[0]?.email_address;
  const firstName = body.first_name ?? undefined;
  const skip_welcome_email = body?.public_metadata?.skip_welcome_email;

  if (email != null && !skip_welcome_email) {
    try {
      await sendWelcomeEmail(email, firstName);
    } catch (emailErr) {
      // Email failure must never prevent token granting.
      console.error(`[handleUserCreated] Failed to send welcome email to ${email}:`, emailErr);
    }
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  if (email != null) {
    await Promise.all([
      conn.execute(
        `
        INSERT INTO gc_emails (email, campaign, user_id, first_name)
        VALUES (?, "signup_urgent", ?, ?);
        `,
        [email, userId, firstName]
      ),
      upsertLeadToDb({
        userId,
        email,
        firstName,
      }),
    ]);
  }

  await capture(
    "user_signup_webhook",
    {
      first_name: firstName,
    },
    userId
  );

  console.info(`[handleUserCreated] Granting 30 trial tokens to user ${userId}`);
  let tokenGranted = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await insertTrialTokens(conn, userId);
      console.info(
        `[handleUserCreated] Successfully granted 30 trial tokens to user ${userId} (attempt ${attempt})`
      );
      tokenGranted = true;
      break;
    } catch (err) {
      console.error(
        `[handleUserCreated] Failed to grant 30 trial tokens to user ${userId} (attempt ${attempt}):`,
        err
      );
    }
  }
  if (!tokenGranted) {
    console.error(
      `[handleUserCreated] Exhausted retries granting trial tokens for user ${userId}. Tokens will be auto-granted on first dashboard visit.`
    );
  }

  await insertTemplateTranscript(userId);
}
