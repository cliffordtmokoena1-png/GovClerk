const BREVO_BASE_URL = "https://api.brevo.com/v3";

function getBrevoApiKey(): string {
  const apiKey = process.env.BREVO_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("BREVO_API_KEY is not configured");
  }
  return apiKey;
}

function brevoHeaders() {
  return {
    "Content-Type": "application/json",
    "api-key": getBrevoApiKey(),
  };
}

export type SendTransactionalEmailParams = {
  to: { email: string; name?: string }[];
  sender: { email: string; name?: string };
  subject: string;
  htmlContent?: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
  cc?: { email: string }[];
  bcc?: { email: string }[];
};

export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  const res = await fetch(`${BREVO_BASE_URL}/smtp/email`, {
    method: "POST",
    headers: brevoHeaders(),
    body: JSON.stringify(params),
  });

  // eslint-disable-next-line no-console
  console.log("sendTransactionalEmail response", res.status);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send Brevo transactional email: ${res.status} - ${text}`);
  }
}
