import getPrimaryEmail from "@/utils/email";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { ipAddress } from "@vercel/functions";
import withErrorReporting from "@/error/withErrorReporting";
import { readMetaConversionData, writeMetaConversionData } from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json();

  const {
    eventName,
    firstName,
    lastName,
  }: {
    eventName: string;
    firstName: string | undefined;
    lastName: string | undefined;
  } = body;

  const site = getSiteFromHeaders(req.headers);
  let email = await getPrimaryEmail(userId, site);
  if (email == null) {
    return new Response(null, { status: 400 });
  }

  const clientUserAgent = req.headers.get("user-agent") ?? undefined;
  const clientIpAddress = ipAddress(req);
  const fbcRaw = req.cookies.get("_fbc");
  const fbc = fbcRaw == null ? undefined : fbcRaw.value;
  const fbpRaw = req.cookies.get("_fbp");
  const fbp = fbpRaw == null ? undefined : fbpRaw.value;

  const eventSourceUrl = req.headers.get("referer") ?? undefined;

  const metaConversionData = await readMetaConversionData(userId);
  if (metaConversionData != null) {
    // Already logged.  Avoid sending Meta a duplicate CompleteRegistration.
    return new Response(null, { status: 200 });
  }

  // Save conversion data for later conversion events like Purchase.
  await writeMetaConversionData({
    userId,
    email,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
  });

  await sendConversionEvent(
    {
      eventName: "CompleteRegistration",
      userId,
      email,
      fbc,
      fbp,
      clientIpAddress,
      clientUserAgent,
      firstName: firstName?.toLowerCase().trim(),
      lastName: lastName?.toLowerCase().trim(),
      eventSourceUrl,
    },
    {}
  );

  return new Response(null, { status: 200 });
}

export default withErrorReporting(handler);
