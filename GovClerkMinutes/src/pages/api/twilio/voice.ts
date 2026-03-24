import type { NextApiRequest, NextApiResponse } from "next";
import { TWILIO_CALLER_ID } from "@/admin/twilio/consts";

// Twilio will request this URL from Twilio's servers, so do NOT require admin auth here.
// Configure the TwiML App in the Twilio Console to use GET when calling this URL.

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const callerId = TWILIO_CALLER_ID;

  // Read the destination number from query (recommended: set TwiML App to GET)
  // Fallback to body if someone posts JSON manually.
  const toParam = (req.query.To as string) || (req.body && (req.body.To as string)) || "";
  const to = (toParam || "").trim();

  // Basic validation
  if (!to) {
    // Return minimal TwiML that says the number was missing
    const response =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      "<Response>\n" +
      '  <Say voice="Polly.Joanna">Missing destination number.</Say>\n' +
      "</Response>";
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(response);
  }

  // Build TwiML to dial a PSTN number with your Twilio caller ID
  const twiml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    "<Response>\n" +
    '  <Dial callerId="' +
    escapeXml(callerId) +
    '">\n' +
    "    <Number>" +
    escapeXml(to) +
    "</Number>\n" +
    "  </Dial>\n" +
    "</Response>";

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml);
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Note: If you prefer POST from Twilio, change the TwiML App to POST and
// add custom parsing here for application/x-www-form-urlencoded.
