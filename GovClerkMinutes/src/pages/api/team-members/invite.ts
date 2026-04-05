import { NextApiRequest, NextApiResponse } from "next";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { randomBytes } from "crypto";
import withErrorReporting from "@/error/withErrorReporting";
import { getCustomerDetails } from "@/pages/api/get-customer-details";
import { getMaxMembers } from "@/utils/teamMembers";
import { isUnknownColumnOrMissingTableError } from "@/utils/dbErrors";
import { sendEmail, isValidEmailFormat } from "@/utils/postmark";

const FROM_ADMIN = '"GovClerk Minutes" <admin@govclerkminutes.com>';
const NAVY = "#1a3c6e";

async function sendInviteEmail({
  toEmail,
  inviterName,
  token,
}: {
  toEmail: string;
  inviterName: string;
  token: string;
}) {
  const acceptUrl = `https://govclerkminutes.com/invite/${token}`;
  await sendEmail({
    From: FROM_ADMIN,
    To: toEmail,
    Subject: `${inviterName} invited you to collaborate on GovClerk Minutes`,
    HtmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="background-color:${NAVY};padding:28px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:0.5px;">GovClerk Minutes</h1></td></tr><tr><td style="padding:40px 40px 32px;"><p style="margin:0 0 16px;font-size:16px;color:#2d3748;">You've been invited!</p><p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;"><strong>${inviterName}</strong> has invited you to collaborate on <strong>GovClerk Minutes</strong> — a platform purpose-built to help government clerks and municipal professionals produce accurate, professional meeting minutes with ease.</p><p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">Click the button below to accept your invitation. You may need to create an account or sign in first.</p><p style="text-align:center;margin:0 0 28px;"><a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;background-color:${NAVY};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Accept Invitation →</a></p><p style="margin:0 0 8px;font-size:13px;color:#8a94a6;">Or copy this link into your browser:<br/>${acceptUrl}</p><p style="margin:24px 0 0;font-size:15px;color:#2d3748;">Warm regards,<br/><strong>Cliff Mokoena</strong><br/><span style="color:#8a94a6;font-size:13px;">Founder, GovClerk Minutes</span></p></td></tr><tr><td style="background-color:#f8f9fb;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;"><p style="margin:0;font-size:12px;color:#8a94a6;">GovClerk Minutes · <a href="https://govclerkminutes.com" style="color:${NAVY};text-decoration:none;">govclerkminutes.com</a><br/>Questions? Email us at <a href="mailto:support@govclerkminutes.com" style="color:${NAVY};text-decoration:none;">support@govclerkminutes.com</a></p></td></tr></table></td></tr></table></body></html>`,
    TextBody: `You've been invited!\n\n${inviterName} has invited you to collaborate on GovClerk Minutes — a platform purpose-built to help government clerks and municipal professionals produce accurate, professional meeting minutes with ease.\n\nTo accept your invitation, visit:\n${acceptUrl}\n\nYou may need to create an account or sign in first.\n\nWarm regards,\nCliff Mokoena\nFounder, GovClerk Minutes\ngovclerkminutes.com`,
    MessageStream: "outbound",
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { email } = req.body as { email?: string };
  if (!email || !isValidEmailFormat(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Determine plan limits
  const customerDetails = await getCustomerDetails(userId);
  const plan = customerDetails.planName ?? "Free";
  const maxMembers = getMaxMembers(plan);

  // Count current non-revoked members (excluding owner)
  let currentCount = 0;
  try {
    const countResult = await conn.execute<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM gc_team_members WHERE owner_user_id = ? AND status != 'revoked'`,
      [userId]
    );
    currentCount = Number(countResult.rows[0]?.cnt ?? 0);
  } catch (err) {
    if (!isUnknownColumnOrMissingTableError(err)) throw err;
  }

  // +1 for the owner themselves
  if (currentCount + 1 >= maxMembers) {
    return res.status(403).json({
      error: "Member limit reached. Upgrade your plan to add more members.",
    });
  }

  // Generate unique invite token
  const token = randomBytes(32).toString("hex");

  try {
    await conn.execute(
      `INSERT INTO gc_team_members (owner_user_id, member_email, invite_token, status)
       VALUES (?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE invite_token = VALUES(invite_token), status = 'pending', invited_at = CURRENT_TIMESTAMP`,
      [userId, normalizedEmail, token]
    );
  } catch (err) {
    if (isUnknownColumnOrMissingTableError(err)) {
      return res.status(503).json({
        error: "Team members feature is not yet available. Please run the database migration.",
      });
    }
    throw err;
  }

  // Get inviter's display name
  let inviterName = "A team member";
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const first = user.firstName ?? "";
    const last = user.lastName ?? "";
    inviterName = [first, last].filter(Boolean).join(" ") || user.emailAddresses[0]?.emailAddress || "A team member";
  } catch (err) {
    console.warn("[team-members/invite] Could not fetch inviter name:", err);
  }

  await sendInviteEmail({ toEmail: normalizedEmail, inviterName, token });

  return res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
