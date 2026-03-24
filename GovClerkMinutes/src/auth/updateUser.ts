import { getClerkKeys } from "@/utils/clerk";
import type { Site } from "@/utils/site";

export async function updateUser(userId: string, firstName: string, site?: Site): Promise<void> {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getClerkKeys(site).secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: firstName,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update user ${userId}: ${res.status} ${res.statusText} — ${body}`);
  }
}
