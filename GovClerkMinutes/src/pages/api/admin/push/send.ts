import type { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { sendPushToAdmins, type PushContent } from "@/push/sendWebPush";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const content = (req.body ?? {}) as PushContent;

  try {
    await sendPushToAdmins(content);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Failed to send admin push", err);
    return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
  }
}

export default withErrorReporting(handler);
