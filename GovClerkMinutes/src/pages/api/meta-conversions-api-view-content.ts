import getPrimaryEmail from "@/utils/email";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { ipAddress } from "@vercel/functions";
import withErrorReporting from "@/error/withErrorReporting";
import { readMetaConversionData } from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);

  const site = getSiteFromHeaders(req.headers);
  const email = userId != null ? await getPrimaryEmail(userId, site) : undefined;

  const clientUserAgent = req.headers.get("user-agent") ?? undefined;
  const clientIpAddress = ipAddress(req);
  const fbcRaw = req.cookies.get("_fbc");
  let fbc = fbcRaw == null ? undefined : fbcRaw.value;
  const fbpRaw = req.cookies.get("_fbp");
  const fbp = fbpRaw == null ? undefined : fbpRaw.value;

  const eventSourceUrl = req.headers.get("referer") ?? undefined;

  if (userId != null && fbc == null) {
    // Read the stored fbc, then send it back to the client so the client can store it as a cookie.
    const metaConversionData = await readMetaConversionData(userId);
    fbc = metaConversionData?.fbc;
  }

  await sendConversionEvent(
    {
      eventName: "ViewContent",
      userId: userId ?? undefined,
      email: email ?? undefined,
      fbc,
      fbp,
      clientIpAddress,
      clientUserAgent,
      eventSourceUrl,
    },
    {}
  );

  return new Response(JSON.stringify({ fbc }), { status: 200 });
}

export default withErrorReporting(handler);
