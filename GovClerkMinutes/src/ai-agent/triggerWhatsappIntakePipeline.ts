import { Connection } from "@planetscale/database";

/**
 * Trigger the standard post-signup pipeline for a WhatsApp-only user
 * who has just provided their email address via the AI agent.
 *
 * This inserts a gc_emails row with campaign='signup_urgent' so that
 * runPostSignupTasks() picks it up within 5 minutes and:
 * - Adds them to the Instantly signup_urgent email sequence
 * - Sends the Meta CompleteRegistration conversion event
 */
export async function triggerWhatsappIntakePipeline({
  conn,
  userId,
  email,
}: {
  conn: Connection;
  userId: string;
  email: string;
}): Promise<void> {
  // Check if a signup_urgent email row already exists for this user
  const existing = await conn
    .execute<{
      cnt: number;
    }>("SELECT COUNT(*) AS cnt FROM gc_emails WHERE user_id = ? AND campaign = 'signup_urgent'", [userId])
    .then((r) => Number(r.rows?.[0]?.cnt ?? 0));

  if (existing > 0) {
    // Already queued — don't duplicate
    return;
  }

  await conn.execute(
    `INSERT INTO gc_emails (user_id, email, campaign, should_email, created_at)
     VALUES (?, ?, 'signup_urgent', 1, UTC_TIMESTAMP())`,
    [userId, email]
  );

  console.log(
    `[triggerWhatsappIntakePipeline] Queued signup_urgent for userId=${userId} email=${email}`
  );
}
