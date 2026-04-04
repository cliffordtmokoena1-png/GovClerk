import { createClerkClient, User } from "@clerk/backend";
import type { NextApiRequest, NextApiResponse } from "next";
import { getClerkKeysFromEnv, ClerkEnvironment } from "@/utils/clerk";
import withErrorReporting from "@/error/withErrorReporting";
import { withServiceAccountOrAdminAuth } from "@/utils/serviceAccountAuth";
import { getCurrentBalance } from "../get-tokens";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { Site } from "@/utils/site";

export type PortalOrgInfo = {
  orgId: string;
  tier: string | null;
  status: string;
  streamHoursIncluded: number;
  streamHoursUsed: number;
};

export type LookupUserApiResponse = {
  userId: string;
  email: string;
  displayName?: string;
  tokens: number;
  portalOrg?: PortalOrgInfo;
};

async function tryClient(
  identifier: string,
  env: ClerkEnvironment,
  site: Site
): Promise<User | null> {
  const keys = getClerkKeysFromEnv(env, site);
  if (!keys?.secretKey) {
    return null;
  }
  const client = createClerkClient({ secretKey: keys.secretKey });

  const isEmail = identifier.includes("@");

  try {
    if (isEmail) {
      const usersResponse = await client.users.getUserList({ emailAddress: [identifier] });
      if (usersResponse.data && usersResponse.data.length > 0) {
        return usersResponse.data[0];
      }
      return null;
    } else {
      return client.users.getUser(identifier);
    }
  } catch (_) {
    return null;
  }
}

type LookupResult = { kind: "success"; user: User } | { kind: "error"; err: string };

const LOOKUP_COMBOS: Array<{ env: ClerkEnvironment; site: Site }> = [
  { env: "prod", site: "GovClerkMinutes" },
  { env: "dev", site: "GovClerkMinutes" },
  { env: "prod", site: "GovClerk" },
  { env: "dev", site: "GovClerk" },
];

async function findUserIdByIdentifier(identifier: string): Promise<LookupResult> {
  const isEmail = identifier.includes("@");

  for (const { env, site } of LOOKUP_COMBOS) {
    const user = await tryClient(identifier, env, site);
    if (user) {
      return { kind: "success", user };
    }
  }

  return {
    kind: "error",
    err: isEmail
      ? `No user found with email: ${identifier}`
      : `No user found with ID: ${identifier}`,
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LookupUserApiResponse | { error: string }>
) {
  const persona = req.headers["x-service-account-persona"];
  if (persona) {
    console.log(`[admin/lookup-user] Called by service account: ${persona}`);
  }

  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: "Email or user ID required" });
  }

  try {
    const lookupResult = await findUserIdByIdentifier(identifier);

    if (lookupResult.kind === "error") {
      return res.status(404).json({ error: lookupResult.err });
    }

    const { user } = lookupResult;

    const tokens = (await getCurrentBalance(user.id)) || 0;

    // Look up portal org membership by email
    const email = user.emailAddresses[0]?.emailAddress || "";
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
    let portalOrg: PortalOrgInfo | undefined;

    try {
      const portalConn = getPortalDbConnection();

      const portalUserRows = await portalConn
        .execute(
          "SELECT org_id FROM gc_portal_users WHERE email = ? AND role = 'admin' LIMIT 1",
          [email]
        )
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
      console.warn("[admin/lookup-user] Could not fetch portal org info:", e);
    }

    return res.status(200).json({
      userId: user.id,
      email,
      displayName,
      tokens,
      portalOrg,
    });
  } catch (error) {
    console.error("[admin/lookup-user] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(withServiceAccountOrAdminAuth(handler));
