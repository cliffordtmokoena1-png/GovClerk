import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";
import twilio from "twilio";
import { assertString } from "@/utils/assert";
import { TWILIO_APP_ID } from "@/admin/twilio/consts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  try {
    const twilioAccountSid = assertString(process.env.TWILIO_ACCOUNT_SID);
    const twilioApiKey = assertString(process.env.TWILIO_API_KEY);
    const twilioApiSecret = assertString(process.env.TWILIO_API_SECRET);

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_APP_ID,
      incomingAllow: true,
    });

    const token = new AccessToken(twilioAccountSid, twilioApiKey, twilioApiSecret, {
      identity: adminUserId,
      ttl: 10 * 60 * 60, // 10 hours
    });
    token.addGrant(voiceGrant);

    return res.status(200).json({ token: token.toJwt(), product: "voice" });
  } catch (error) {
    console.error("[admin/twilio/get-token] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}

export default withErrorReporting(handler);
