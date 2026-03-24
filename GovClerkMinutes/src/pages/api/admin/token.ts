import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";

type TokenResponse = {
  userId: string;
  amount: number;
  id: string;
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

async function modifyUserToken(
  userId: string,
  amount: number,
  isAdd: boolean,
  orgId?: string
): Promise<string> {
  const finalAmount = isAdd ? Math.abs(amount) : -Math.abs(amount);

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  console.log(
    `[admin/token] Crediting user_id=${userId}${orgId ? ` org_id=${orgId}` : ""} with ${finalAmount} credits`
  );

  if (orgId) {
    // Insert tokens scoped to the organisation so org-context balance queries find them.
    try {
      const result = await conn.execute(
        "INSERT INTO payments (user_id, org_id, credit, action) VALUES (?, ?, ?, ?)",
        [userId, orgId, finalAmount, "admin"]
      );
      return result.insertId.toString();
    } catch (error: unknown) {
      if (isActionColumnMissing(error)) {
        console.warn("[admin/token] 'action' column not found, retrying without it");
        const result = await conn.execute(
          "INSERT INTO payments (user_id, org_id, credit) VALUES (?, ?, ?)",
          [userId, orgId, finalAmount]
        );
        return result.insertId.toString();
      }
      throw error;
    }
  }

  // Default: insert as personal tokens (org_id = NULL).
  // These are always visible to the user regardless of their org context
  // because get-tokens.ts now queries both personal and org balances.
  try {
    const result = await conn.execute(
      "INSERT INTO payments (user_id, org_id, credit, action) VALUES (?, NULL, ?, ?)",
      [userId, finalAmount, "admin"]
    );
    return result.insertId.toString();
  } catch (error: unknown) {
    // Fallback for DB branches that don't have the 'action' column (errno 1054)
    if (isActionColumnMissing(error)) {
      console.warn("[admin/token] 'action' column not found, retrying without it");
      const result = await conn.execute(
        "INSERT INTO payments (user_id, org_id, credit) VALUES (?, NULL, ?)",
        [userId, finalAmount]
      );
      return result.insertId.toString();
    }
    throw error;
  }
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenResponse | { error: string }>
) {
  const { userId, sessionClaims } = getAuth(req);

  if (!userId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userId: targetUserId, amount, action, orgId: targetOrgId } = req.body;

  if (!targetUserId || typeof amount !== "number") {
    return res.status(400).json({ error: "Missing required fields: userId and amount" });
  }

  if (
    typeof targetUserId !== "string" ||
    (!targetUserId.startsWith("user_") && !targetUserId.startsWith("org_"))
  ) {
    return res.status(400).json({
      error: `Invalid userId format: "${targetUserId}". Must be a Clerk user ID starting with "user_" or "org_".`,
    });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    const transactionId = await modifyUserToken(targetUserId, amount, action === "add", targetOrgId);

    return res.status(200).json({
      userId: targetUserId,
      amount: action === "add" ? Math.abs(amount) : -Math.abs(amount),
      id: transactionId,
    });
  } catch (error) {
    console.error("[admin/token] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(handler);
