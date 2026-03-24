import { createClerkClient } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { getClerkKeys } from "./clerk";
import type { Site } from "./site";

type ResourceAccessResult = {
  hasAccess: boolean;
  orgId: string | null;
};

export async function canAccessResource(
  tableName: string,
  resourceId: number | string,
  userId: string,
  site?: Site
): Promise<boolean> {
  const result = await canAccessResourceWithOrgId(tableName, resourceId, userId, site);
  return result.hasAccess;
}

export async function canAccessResourceWithOrgId(
  tableName: string,
  resourceId: number | string,
  userId: string,
  site?: Site
): Promise<ResourceAccessResult> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const userIdColumn =
    tableName === "transcripts" || tableName === "speakers" ? "userId" : "user_id";

  const rows = await conn
    .execute(`SELECT ${userIdColumn} as user_id, org_id FROM ${tableName} WHERE id = ? LIMIT 1`, [
      resourceId,
    ])
    .then((res) => res.rows);

  if (rows.length === 0) {
    return { hasAccess: false, orgId: null };
  }

  const row = rows[0];
  const resourceUserId = row["user_id"] as string;
  const resourceOrgId = row["org_id"] as string | null;

  if (!resourceOrgId) {
    return {
      hasAccess: resourceUserId === userId,
      orgId: null,
    };
  }

  try {
    const clerk = createClerkClient(getClerkKeys(site));
    const orgMembership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: resourceOrgId,
    });

    const hasAccess = orgMembership.data.some(
      (membership: any) => membership.publicUserData?.userId === userId
    );

    return { hasAccess, orgId: resourceOrgId };
  } catch (error) {
    console.error("Error checking org membership for resource access:", error);
    return { hasAccess: false, orgId: null };
  }
}

export function buildResourceAccessFilter(
  userId: string,
  userOrgIds: string[],
  tableName?: string
): { whereClause: string; params: any[] } {
  const userIdColumn =
    tableName === "transcripts" || tableName === "speakers" ? "userId" : "user_id";

  if (userOrgIds.length === 0) {
    return {
      whereClause: `${userIdColumn} = ? AND org_id IS NULL`,
      params: [userId],
    };
  }

  const orgPlaceholders = userOrgIds.map(() => "?").join(", ");
  return {
    whereClause: `(${userIdColumn} = ? AND org_id IS NULL) OR (org_id IN (${orgPlaceholders}))`,
    params: [userId, ...userOrgIds],
  };
}

export async function getUserOrgIds(userId: string, site?: Site): Promise<string[]> {
  try {
    const clerk = createClerkClient(getClerkKeys(site));
    const orgMemberships = await clerk.users.getOrganizationMembershipList({
      userId,
    });

    return orgMemberships.data.map((membership: any) => membership.organization.id);
  } catch (error) {
    console.error("Error fetching user org memberships:", error);
    return [];
  }
}
