import { createClerkClient } from "@clerk/nextjs/server";
import { getClerkKeys } from "./clerk";
import type { Site } from "./site";

export type OrgRole = "org:admin" | "org:member";

export async function isOrgAdmin(userId: string, orgId: string, site?: Site): Promise<boolean> {
  try {
    const clerk = createClerkClient(getClerkKeys(site));
    const orgMembership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    const userMembership = orgMembership.data.find(
      (membership: any) => membership.publicUserData?.userId === userId
    );

    if (!userMembership) {
      return false;
    }

    return userMembership.role === "org:admin";
  } catch (error) {
    console.error("Error checking org admin status:", error);
    throw new Error("Failed to verify organization admin status");
  }
}

export async function getOrgRole(
  userId: string,
  orgId: string,
  site?: Site
): Promise<OrgRole | null> {
  try {
    const clerk = createClerkClient(getClerkKeys(site));
    const orgMembership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    const userMembership = orgMembership.data.find(
      (membership: any) => membership.publicUserData?.userId === userId
    );

    if (!userMembership) {
      return null;
    }

    return userMembership.role as OrgRole;
  } catch (error) {
    console.error("Error getting org role:", error);
    throw new Error("Failed to get organization role");
  }
}

export async function requireOrgAdmin(userId: string, orgId: string, site?: Site): Promise<void> {
  const isAdmin = await isOrgAdmin(userId, orgId, site);
  if (!isAdmin) {
    throw new Error("User must be an organization admin to perform this action");
  }
}
