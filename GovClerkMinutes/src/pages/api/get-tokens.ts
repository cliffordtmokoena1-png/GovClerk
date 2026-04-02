import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";

export const config = {
  runtime: "edge",
};

function isActionColumnMissing(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const e = error as { errno?: number; message?: string };
  return (
    e.errno === 1054 ||
    (typeof e.message === "string" &&
      (e.message.includes("1054") || e.message.includes("Unknown column")))
  );
}

export async function getCurrentBalance(
  userId: string,
  orgId: string | null = null
): Promise<number | null> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  // Returns null when SQL SUM() is NULL (no payment rows exist at all),
  // 0 when rows exist but balance is zero, or the actual balance otherwise.
  // This distinction is important: null triggers the self-healing 30-token
  // grant for new users, while 0 means they legitimately spent all tokens.
  function parseBalance(rows: Record<string, unknown>[]): number | null {
    const raw = rows?.[0] ? (rows[0] as { balance: string | null }).balance : null;
    if (raw === null) return null;
    const val = parseInt(raw as string, 10);
    return isNaN(val) ? 0 : val;
  }

  // Always get the personal balance (rows with org_id IS NULL).
  // Admin-added tokens are always inserted without an org_id, so this
  // ensures they are visible regardless of the user's org context.
  const personalRows = await conn
    .execute("SELECT SUM(credit) AS balance FROM payments WHERE user_id = ? AND org_id IS NULL;", [
      userId,
    ])
    .then((res) => res.rows as Record<string, unknown>[]);

  const personalBalance = parseBalance(personalRows);

  if (orgId) {
    // Also fetch tokens that belong to the organisation.
    const orgRows = await conn
      .execute("SELECT SUM(credit) AS balance FROM payments WHERE org_id = ?;", [orgId])
      .then((res) => res.rows as Record<string, unknown>[]);

    const orgBalance = parseBalance(orgRows);

    // Return the combined total so users can spend both personal and org tokens.
    const total = (personalBalance ?? 0) + (orgBalance ?? 0);
    return total > 0 ? total : null;
  }

  // For personal accounts: null signals "no payment rows ever" (triggers self-healing),
  // 0 signals "had tokens but spent them all" (no self-healing).
  return personalBalance;
}

async function handler(req: NextRequest) {
  const auth = getAuth(req);
  if (auth.userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  const tokens = await getCurrentBalance(userId, orgId);

  // Self-healing: if the user has no payment rows (webhook likely failed silently),
  // auto-grant 30 trial tokens so the dashboard always shows a correct balance.
  if (tokens === null && !orgId) {
    console.warn(`[get-tokens] No payment rows for user ${userId}, auto-granting 30 trial tokens`);
    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });
    try {
      // Idempotency check: only insert if no 'add' action row exists yet to
      // prevent duplicate grants when this endpoint is called concurrently.
      // If the 'action' column is missing (MySQL errno 1054) we treat that as
      // "no existing grant" and fall through to the INSERT fallback below.
      let existingRows: unknown[] = [];
      try {
        existingRows = await conn
          .execute("SELECT id FROM payments WHERE user_id = ? AND action = 'add' LIMIT 1", [userId])
          .then((res) => res.rows);
      } catch (selectErr: unknown) {
        if (!isActionColumnMissing(selectErr)) {
          throw selectErr;
        }
        // 'action' column missing — no 'add' grant row can exist yet; proceed to INSERT fallback
      }

      if (existingRows.length > 0) {
        // A grant row already exists — return the real balance instead.
        const updatedBalance = await getCurrentBalance(userId, null);
        return new Response(JSON.stringify({ tokens: updatedBalance ?? 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        await conn.execute('INSERT INTO payments (user_id, credit, action) VALUES (?, 30, "add")', [
          userId,
        ]);
      } catch (insertErr: unknown) {
        // Some DB branches don't have the 'action' column yet (MySQL errno 1054).
        if (isActionColumnMissing(insertErr)) {
          console.warn("[get-tokens] 'action' column not found, retrying without it");
          await conn.execute("INSERT INTO payments (user_id, credit) VALUES (?, 30)", [userId]);
        } else {
          throw insertErr;
        }
      }
      console.info(`[get-tokens] Auto-granted 30 trial tokens to user ${userId}`);
      return new Response(JSON.stringify({ tokens: 30 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error(`[get-tokens] Failed to auto-grant tokens for user ${userId}:`, err);
      // Fall through: the user has no payment rows and the auto-grant failed,
      // so return 0 to always give the frontend a real number to display.
    }
  }

  return new Response(JSON.stringify({ tokens: tokens ?? 0 }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
