/**
 * POST /api/agent/admin-action
 *
 * Unified endpoint for AI agent personas (Gabriella, Gray, Samantha) to perform
 * admin actions without a Clerk browser session.
 *
 * Auth: Service account API key only (Authorization: Bearer / x-api-key).
 *       No Clerk session required — designed for server-to-server calls.
 *
 * Body:
 * {
 *   "action": "send_login_link" | "generate_checkout_link" | "add_tokens" | "add_stream_hours" | "lookup_user",
 *   "payload": { ...action-specific fields }
 * }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { validateServiceAccountKey } from "@/utils/serviceAccountAuth";
import { connect } from "@planetscale/database";
import { createClerkClient, type User } from "@clerk/backend";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { createUser } from "@/auth/createUser";
import { createSignInToken, getClerkKeysFromEnv } from "@/utils/clerk";
import { sendSignInMagicEmail, sendSignUpMagicEmail } from "@/utils/postmark";
import { getPortalDbConnection } from "@/utils/portalDb";
import { getCurrentBalance } from "@/pages/api/get-tokens";
import { getSiteFromHeaders } from "@/utils/site";

type Action =
  | "send_login_link"
  | "generate_checkout_link"
  | "add_tokens"
  | "add_stream_hours"
  | "lookup_user";

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleSendLoginLink(
  payload: Record<string, unknown>,
  req: NextApiRequest
): Promise<object> {
  const email = payload.email;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ApiError(400, "Valid email address required");
  }

  const site = getSiteFromHeaders(req.headers);
  const userIdFromEmail = await getUserIdFromEmail({ email, env: "prod", site });
  const userExists = userIdFromEmail !== null;

  if (userExists && userIdFromEmail) {
    const token = await createSignInToken(userIdFromEmail, site);
    if (!token) {
      throw new Error(`Failed to create Clerk sign-in token for userId=${userIdFromEmail}`);
    }
    await sendSignInMagicEmail(email, token);
  } else {
    const newUserId = await createUser({ email, firstName: null, env: "prod", site });
    const token = await createSignInToken(newUserId, site);
    if (!token) {
      throw new Error(`Failed to create Clerk sign-in token for userId=${newUserId}`);
    }
    await sendSignUpMagicEmail(email, token);
  }

  return { emailSent: true, isExistingUser: userExists, email };
}

async function handleGenerateCheckoutLink(
  payload: Record<string, unknown>,
  req: NextApiRequest
): Promise<object> {
  const email = payload.email;
  const plan = payload.plan;
  const country = payload.country ?? "ZA";

  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ApiError(400, "Valid email address required");
  }
  if (!plan || typeof plan !== "string") {
    throw new ApiError(400, "plan is required");
  }
  if (!country || typeof country !== "string") {
    throw new ApiError(400, "country is required");
  }

  const site = getSiteFromHeaders(req.headers);
  const userId = await getUserIdFromEmail({ email, env: "prod", site });
  if (userId == null) {
    throw new ApiError(404, "User not found");
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${req.headers.host ?? "govclerkminutes.com"}`;
  const url = `${origin}/subscribe/${country}/${plan}/${userId}`;

  return { url, emailed: false };
}

function isActionColumnMissing(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const e = error as { errno?: number; message?: string };
  return (
    e.errno === 1054 ||
    (typeof e.message === "string" &&
      (e.message.includes("1054") || e.message.includes("Unknown column")))
  );
}

async function handleAddTokens(payload: Record<string, unknown>): Promise<object> {
  const targetUserId = payload.userId;
  const amount = payload.amount;
  const action = payload.action ?? "add";
  const targetOrgId = payload.orgId as string | undefined;

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new ApiError(400, "userId is required");
  }
  if (
    !targetUserId.startsWith("user_") &&
    !targetUserId.startsWith("org_")
  ) {
    throw new ApiError(
      400,
      `Invalid userId format: "${targetUserId}". Must start with "user_" or "org_".`
    );
  }
  if (typeof amount !== "number" || amount <= 0) {
    throw new ApiError(400, "amount must be a positive number");
  }

  const isAdd = action === "add";
  const finalAmount = isAdd ? Math.abs(amount) : -Math.abs(amount);

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  let insertId: string;

  if (targetOrgId) {
    try {
      const result = await conn.execute(
        "INSERT INTO payments (user_id, org_id, credit, action) VALUES (?, ?, ?, ?)",
        [targetUserId, targetOrgId, finalAmount, "admin"]
      );
      insertId = result.insertId.toString();
    } catch (error) {
      if (isActionColumnMissing(error)) {
        const result = await conn.execute(
          "INSERT INTO payments (user_id, org_id, credit) VALUES (?, ?, ?)",
          [targetUserId, targetOrgId, finalAmount]
        );
        insertId = result.insertId.toString();
      } else {
        throw error;
      }
    }
  } else {
    try {
      const result = await conn.execute(
        "INSERT INTO payments (user_id, org_id, credit, action) VALUES (?, NULL, ?, ?)",
        [targetUserId, finalAmount, "admin"]
      );
      insertId = result.insertId.toString();
    } catch (error) {
      if (isActionColumnMissing(error)) {
        const result = await conn.execute(
          "INSERT INTO payments (user_id, org_id, credit) VALUES (?, NULL, ?)",
          [targetUserId, finalAmount]
        );
        insertId = result.insertId.toString();
      } else {
        throw error;
      }
    }
  }

  return { userId: targetUserId, amount: finalAmount, id: insertId };
}

async function handleAddStreamHours(payload: Record<string, unknown>): Promise<object> {
  const orgId = payload.orgId;
  const hours = payload.hours;

  if (!orgId || typeof orgId !== "string") {
    throw new ApiError(400, "orgId is required");
  }
  if (typeof hours !== "number" || hours <= 0) {
    throw new ApiError(400, "hours must be a positive number");
  }

  const conn = getPortalDbConnection();

  const result = await conn.execute(
    `UPDATE gc_portal_subscriptions
     SET stream_hours_included = stream_hours_included + ?
     WHERE org_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [hours, orgId]
  );

  if (!result.rowsAffected || Number(result.rowsAffected) === 0) {
    throw new ApiError(404, `No active subscription found for org ${orgId}`);
  }

  const rows = await conn
    .execute(
      "SELECT stream_hours_included FROM gc_portal_subscriptions WHERE org_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [orgId]
    )
    .then((r) => r.rows as { stream_hours_included: number }[]);

  const newStreamHoursIncluded = Number(rows[0]?.stream_hours_included ?? 0);

  return { orgId, hoursAdded: hours, newStreamHoursIncluded };
}

async function handleLookupUser(payload: Record<string, unknown>): Promise<object> {
  const identifier = payload.identifier;

  if (!identifier || typeof identifier !== "string") {
    throw new ApiError(400, "identifier (email or user ID) is required");
  }

  const isEmail = identifier.includes("@");

  // Try all Clerk environments to find the user (mirrors lookup-user.ts)
  const combos: Array<{ env: "prod" | "dev"; site: "GovClerkMinutes" | "GovClerk" }> = [
    { env: "prod", site: "GovClerkMinutes" },
    { env: "dev", site: "GovClerkMinutes" },
    { env: "prod", site: "GovClerk" },
    { env: "dev", site: "GovClerk" },
  ];

  let foundUser: User | null = null;

  for (const { env, site } of combos) {
    const keys = getClerkKeysFromEnv(env, site);
    if (!keys?.secretKey) continue;

    try {
      const client = createClerkClient({ secretKey: keys.secretKey });
      if (isEmail) {
        const list = await client.users.getUserList({ emailAddress: [identifier] });
        if (list.data?.length) {
          foundUser = list.data[0];
          break;
        }
      } else {
        foundUser = await client.users.getUser(identifier);
        break;
      }
    } catch (_) {
      // try next combo
    }
  }

  if (!foundUser) {
    throw new ApiError(
      404,
      isEmail ? `No user found with email: ${identifier}` : `No user found with ID: ${identifier}`
    );
  }

  const user = foundUser;
  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
  const tokens = (await getCurrentBalance(user.id)) ?? 0;

  let portalOrg: object | undefined;
  try {
    const portalConn = getPortalDbConnection();
    const portalUserRows = await portalConn
      .execute("SELECT org_id FROM gc_portal_users WHERE email = ? AND role = 'admin' LIMIT 1", [
        email,
      ])
      .then((r) => r.rows as { org_id: string }[]);

    if (portalUserRows.length > 0) {
      const orgId = portalUserRows[0].org_id;
      const subRows = await portalConn
        .execute(
          "SELECT tier, status, stream_hours_included, stream_hours_used FROM gc_portal_subscriptions WHERE org_id = ? ORDER BY created_at DESC LIMIT 1",
          [orgId]
        )
        .then(
          (r) =>
            r.rows as {
              tier: string;
              status: string;
              stream_hours_included: number;
              stream_hours_used: number;
            }[]
        );

      if (subRows.length > 0) {
        const sub = subRows[0];
        portalOrg = {
          orgId,
          tier: sub.tier ?? null,
          status: sub.status,
          streamHoursIncluded: Number(sub.stream_hours_included),
          streamHoursUsed: Number(sub.stream_hours_used),
        };
      } else {
        portalOrg = { orgId, tier: null, status: "none", streamHoursIncluded: 0, streamHoursUsed: 0 };
      }
    }
  } catch (e) {
    console.warn("[agent/admin-action] Could not fetch portal org info:", e);
  }

  return { userId: user.id, email, displayName, tokens, portalOrg };
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth — service account API key only (no Clerk session needed)
  const serviceAuth = validateServiceAccountKey(req);
  if (!serviceAuth.valid) {
    return res.status(401).json({ error: "Unauthorized: valid service account API key required" });
  }

  const { persona } = serviceAuth;
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const action = body?.action as Action | undefined;
  const payload = (body?.payload ?? {}) as Record<string, unknown>;

  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }

  console.log(`[agent/admin-action] persona=${persona} action=${action}`);

  try {
    let result: object;

    switch (action) {
      case "send_login_link":
        result = await handleSendLoginLink(payload, req);
        break;
      case "generate_checkout_link":
        result = await handleGenerateCheckoutLink(payload, req);
        break;
      case "add_tokens":
        result = await handleAddTokens(payload);
        break;
      case "add_stream_hours":
        result = await handleAddStreamHours(payload);
        break;
      case "lookup_user":
        result = await handleLookupUser(payload);
        break;
      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid actions: send_login_link, generate_checkout_link, add_tokens, add_stream_hours, lookup_user`,
        });
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(`[agent/admin-action] persona=${persona} action=${action} error:`, error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(handler);
