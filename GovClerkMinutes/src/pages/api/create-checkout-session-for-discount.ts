import { NextApiRequest, NextApiResponse } from "next";
import { createCheckoutSession } from "./create-checkout-session";
import withErrorReporting from "@/error/withErrorReporting";
import { getClientReferenceId } from "@/utils/getClientReferenceId";
import { getCountry } from "./get-country";
import { assertString } from "@/utils/assert";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { getSiteFromRequest } from "@/utils/site";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = JSON.parse(req.body);
  const email = assertString(body.email);

  const site = getSiteFromRequest(req);
  const [country, userId] = await Promise.all([
    getCountry((h) => req.headers[h] as any),
    getUserIdFromEmail({ email, site }),
  ]);

  if (userId == null) {
    return res.status(404).json({ error: "User not found" });
  }

  const session = await createCheckoutSession({
    clientReferenceId: getClientReferenceId(undefined, userId),
    customerEmail: email,
    plan: "Basic",
    country: country ?? "US",
    mode: "subscription",
    successUrl: `${req.headers.origin}/sign-in`,
    cancelUrl: `${req.headers.origin}/discount`,
  });
  return res.status(200).json({ url: session.url });
}

export default withErrorReporting(handler);
