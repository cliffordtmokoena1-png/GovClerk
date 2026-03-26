import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import get_presigned_url from "@/s3/get_presigned_url";
import type { BucketName, Region } from "@/utils/s3";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing required query param: key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // WhatsApp media lives in a dedicated bucket/region.
    const bucket: BucketName = "GovClerkMinuteswhatsapp";
    const region: Region = "us-east-1";

    const accessKeyId = assertString(process.env.AWS_WHATSAPP_ACCESS_KEY);
    const secretAccessKey = assertString(process.env.AWS_WHATSAPP_ACCESS_KEY_SECRET);

    const { presignedUrl } = await get_presigned_url({
      key,
      method: "GET",
      expiresInSecs: 600,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
    });

    return Response.redirect(presignedUrl, 302);
  } catch (error) {
    console.error("[admin/get-whatsapp-file] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
