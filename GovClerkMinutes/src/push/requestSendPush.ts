import { assertString } from "@/utils/assert";
import { isDev } from "@/utils/dev";

export type PushContent = {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
};

// NOTE: Only call this on the server when in a nodejs environment.
// If you want to send a push from an edge runtime environment, then just call
// sendWebPush directly.
export default async function requestSendPush(content: PushContent): Promise<void> {
  try {
    const baseUrl = isDev() ? "http://localhost:3000" : "https://GovClerkMinutes.com";
    const secret = assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET);
    const res = await fetch(`${baseUrl}/api/admin/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(content),
    });
    if (!res.ok) {
      console.error("Admin push API responded non-OK", { status: res.status });
    }
  } catch (e) {
    console.error("Failed to call admin push API", e);
  }
}
