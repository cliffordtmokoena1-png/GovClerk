import { connect } from "@planetscale/database";

export type SubscriptionContext = {
  billingType: "personal" | "organization" | "none";
  orgId: string | null;
  orgName: string | null;
};

export async function getSubscriptionContext(userId: string): Promise<SubscriptionContext> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      `SELECT mc.org_id, o.name as org_name
       FROM gc_customers mc
       LEFT JOIN organizations o ON mc.org_id = o.id
       WHERE mc.user_id = ?
       LIMIT 1`,
      [userId]
    )
    .then((res) => res.rows);

  if (rows.length === 0) {
    return {
      billingType: "none",
      orgId: null,
      orgName: null,
    };
  }

  const row = rows[0];
  const orgId = row["org_id"] as string | null;
  const orgName = row["org_name"] as string | null;

  return {
    billingType: orgId ? "organization" : "personal",
    orgId,
    orgName,
  };
}
