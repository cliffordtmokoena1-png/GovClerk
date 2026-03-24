import { serverUri } from "@/utils/server";

export async function createAuthToken(userId: string): Promise<string> {
  const webhookSecret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("[createAuthToken] UPLOAD_COMPLETE_WEBHOOK_SECRET is not configured");
  }

  try {
    const resp = await fetch(serverUri("/api/auth/create-auth-token"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${webhookSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Auth token creation failed: ${resp.status} ${resp.statusText}`);
    }

    const { token } = await resp.json();
    return token;
  } catch (error) {
    console.error(`[createAuthToken] Error creating auth token for userId=${userId}:`, error);
    throw error;
  }
}
