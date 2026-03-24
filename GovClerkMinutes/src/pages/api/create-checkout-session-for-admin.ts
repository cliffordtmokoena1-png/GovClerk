import { NextApiRequest, NextApiResponse } from "next";
import { createCheckoutSession } from "./create-checkout-session";
import withErrorReporting from "@/error/withErrorReporting";
import { getClientReferenceId } from "@/utils/getClientReferenceId";
import { isPaidSubscriptionPlan } from "@/utils/price";
import { assertString } from "@/utils/assert";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { getSiteFromRequest } from "@/utils/site";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body;
  const email = assertString(body.email);
  const country = assertString(body.country);
  const plan = assertString(body.plan);

  if (!isPaidSubscriptionPlan(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  const site = getSiteFromRequest(req);
  const userId = await getUserIdFromEmail({ email, site });
  if (userId == null) {
    return res.status(404).json({ error: "User not found" });
  }

  const session = await createCheckoutSession({
    clientReferenceId: getClientReferenceId(undefined, userId),
    customerEmail: email,
    plan,
    country,
    mode: "subscription",
    successUrl: `${req.headers.origin}/sign-in`,
    cancelUrl: `${req.headers.origin}/`,
  });
  return res.status(200).json({ url: session.url });
}

export default withErrorReporting(handler);

