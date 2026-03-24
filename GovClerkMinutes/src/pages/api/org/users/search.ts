import { getAuth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getClerkKeys } from "@/utils/clerk";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  const { userId, orgId } = getAuth(req);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("query");

  if (!query) {
    return NextResponse.json([]);
  }

  const keys = getClerkKeys(getSiteFromHeaders(req.headers));
  const clerkClient = createClerkClient({
    secretKey: keys.secretKey,
    publishableKey: keys.publishableKey,
  });

  try {
    let users;
    if (orgId) {
      users = await clerkClient.users.getUserList({
        organizationId: [orgId],
        query,
        limit: 10,
      });
    } else {
      // If no org context, return empty list to avoid leaking global users
      return NextResponse.json([]);
    }

    const results = users.data.map((user) => ({
      id: user.id,
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.username ||
        user.emailAddresses[0]?.emailAddress ||
        "Unknown",
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      email: user.emailAddresses[0]?.emailAddress,
      imageUrl: user.imageUrl,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error searching users:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
