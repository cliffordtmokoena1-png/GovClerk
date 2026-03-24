import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

export type ApiGetCountryResponse = {
  country: string | null;
};

export function getCountry(getHeader: (h: string) => string | null | undefined): string | null {
  const country = getHeader("x-vercel-ip-country");

  if (!country) {
    return null;
  }
  return country;
}

async function handler(req: NextRequest) {
  const res: ApiGetCountryResponse = {
    country: getCountry((h) => req.headers.get(h)),
  };

  return new Response(JSON.stringify(res), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
