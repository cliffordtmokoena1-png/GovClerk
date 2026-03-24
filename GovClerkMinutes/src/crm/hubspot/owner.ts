import getPrimaryEmail from "@/utils/email";
import { HUBSPOT_OWNER_IDS } from "./consts";

export function getOwnerIdFromEmail(email: string): string | null {
  for (const owner of Object.values(HUBSPOT_OWNER_IDS)) {
    if (owner.email === email) {
      return owner.id;
    }
  }
  return null;
}

export async function getOwnerIdFromUserId(userId: string): Promise<string | null> {
  const email = await getPrimaryEmail(userId);
  if (email == null) {
    return null;
  }
  return getOwnerIdFromEmail(email);
}
