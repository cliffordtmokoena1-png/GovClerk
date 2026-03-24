import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { readMetaConversionData } from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";

export const config = {
  runtime: "edge",
};

function parseFirstName(fullName: string | undefined): string | undefined {
  if (fullName == null) {
    return undefined;
  }
  return fullName.split(" ")[0].toLowerCase();
}

function parseLastName(fullName: string | undefined): string | undefined {
  if (fullName == null) {
    return undefined;
  }
  return fullName.split(" ").slice(1).join(" ").toLowerCase();
}

function parsePhoneNumber(phone: string | undefined): string | undefined {
  if (phone == null) {
    return undefined;
  }
  return phone.replace(/\D/g, "");
}

async function handler(req: NextRequest) {
  const body = await req.json();

  const {
    email,
    userId,
    currency,
    value,
    name,
    state,
    zipCode,
    phone,
    country,
    city,
  }: {
    email: string | undefined;
    userId: string;
    currency: string | undefined;
    value: number | undefined;
    name: string | undefined;
    state: string | undefined;
    zipCode: string | undefined;
    phone: string | undefined;
    country: string | undefined;
    city: string | undefined;
  } = body;

  const metaConversionData = await readMetaConversionData(userId);

  const storedUserData = { ...metaConversionData };
  const { fbc, fbp, clientIpAddress, clientUserAgent } = storedUserData;

  await sendConversionEvent(
    {
      eventName: "Purchase",
      userId,
      email,
      ph: parsePhoneNumber(phone),
      st: state,
      zp: zipCode,
      country: country,
      ct: city,
      firstName: parseFirstName(name),
      lastName: parseLastName(name),
      fbc,
      fbp,
      clientIpAddress,
      clientUserAgent,
    },
    {
      currency: currency?.toLowerCase(),
      value: value == null ? undefined : value / 100.0,
    }
  );

  return new Response(null, { status: 200 });
}

export default withErrorReporting(handler);
