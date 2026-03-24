import { DeletedObjectJSON } from "@clerk/nextjs/dist/types/server";
import { deleteOrganizationById } from "@/webhook/clerk/syncOrganization";

export async function handleOrganizationDeleted(body: DeletedObjectJSON): Promise<void> {
  await deleteOrganizationById(body.id);
}
