import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { readMetaConversionData } from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";

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
    firstName,
    lastName,
  }: {
    firstName: string | undefined;
    lastName: string | undefined;
  } = body;

  const metaConversionData = await readMetaConversionData(userId);

  const storedUserData = { ...metaConversionData };
  const { email, fbc, fbp, clientIpAddress, clientUserAgent } = storedUserData;

  await sendConversionEvent(
    {
      eventName: "InitiateCheckout",
      userId,
      email,
      firstName: firstName?.toLowerCase().trim(),
      lastName: lastName?.toLowerCase().trim(),
      fbc,
      fbp,
      clientIpAddress,
      clientUserAgent,
    },
    {}
  );

  return new Response(null, { status: 200 });
}

export default withErrorReporting(handler);
