import { getAuth } from "@clerk/nextjs/server";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { fetchSettings } from "@/settings/settings";

export const config = {
  runtime: "edge",
};

export type ApiGetSettingsResponse = Record<string, unknown>;

async function handler(req: NextRequest) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return new Response(null, { status: 401 });
  }

  const settings = await fetchSettings(userId);

  return new Response(JSON.stringify(settings), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
