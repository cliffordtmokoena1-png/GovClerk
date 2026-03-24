import { getAllWebhookKeys } from "@/utils/clerk";
import type { Site } from "@/utils/site";
import { NextApiRequest } from "next";
import { Webhook } from "svix";

export async function isWebhookRequestValid(req: NextApiRequest): Promise<Site | null> {
  const svixHeaders: Record<string, string> = {
    "svix-id": req.headers["svix-id"] as string,
    "svix-timestamp": req.headers["svix-timestamp"] as string,
    "svix-signature": req.headers["svix-signature"] as string,
  };

  const body = JSON.stringify(req.body);

  for (const { key, site } of getAllWebhookKeys()) {
    try {
      const wh = new Webhook(key);
      await wh.verify(body, svixHeaders);
      return site;
    } catch {
      continue;
    }
  }

  console.error("Webhook verification failed for all keys");
  return null;
}
