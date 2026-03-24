import { OrganizationJSON } from "@clerk/nextjs/dist/types/server";
import { upsertOrganizationFromWebhook } from "@/webhook/clerk/syncOrganization";

export async function handleOrganizationUpdated(body: OrganizationJSON): Promise<void> {
  await upsertOrganizationFromWebhook(body);
}
