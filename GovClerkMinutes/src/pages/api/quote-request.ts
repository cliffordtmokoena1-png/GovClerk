import withErrorReporting from "@/error/withErrorReporting";
import { updateLeadInDb, upsertLeadToDb } from "@/crm/leads";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { createUser } from "@/auth/createUser";
import { sendSlackWebhook } from "@/utils/slack";
import { NextRequest } from "next/server";
import { capture } from "@/utils/posthog";
import {
  readMetaConversionData,
  writeMetaConversionData,
  getConversionEventDataFromEdgeRequest,
} from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";
import { getSiteFromHeaders } from "@/utils/site";
import { sendLeadWelcome } from "@/ai-agent/sendLeadWelcome";

export const config = {
  runtime: "edge",
};

interface QuoteRequestBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  websiteUrl?: string;
  comments?: string;
  formType?: "demo" | "pricing";
  hcaptchaToken?: string;
}

async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: QuoteRequestBody = await req.json();

    const {
      firstName,
      lastName,
      email,
      phone,
      organizationName,
      websiteUrl,
      comments,
      formType = "pricing",
      hcaptchaToken,
    } = body;

    const trimmedFirstName = firstName?.trim();
    const trimmedLastName = lastName?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedPhone = phone?.trim();
    const trimmedOrganizationName = organizationName?.trim();
    const trimmedWebsiteUrl = websiteUrl?.trim();
    const trimmedComments = comments?.trim();
    const posthogSessionId = req.headers.get("x-posthog-session-id") ?? undefined;

    if (!hcaptchaToken) {
      return new Response(JSON.stringify({ error: "Captcha verification required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;
    if (!hcaptchaSecret) {
      console.error("HCAPTCHA_SECRET_KEY is not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hcaptchaVerifyResponse = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${encodeURIComponent(hcaptchaSecret)}&response=${encodeURIComponent(hcaptchaToken)}`,
    });

    const hcaptchaResult = await hcaptchaVerifyResponse.json();

    if (!hcaptchaResult.success) {
      await capture(
        "quote_request_hcaptcha_failed",
        {
          formType,
          errorCodes: hcaptchaResult["error-codes"],
          $session_id: posthogSessionId,
        },
        "anonymous"
      );
      return new Response(JSON.stringify({ error: "Captcha verification failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (
      !trimmedFirstName ||
      !trimmedLastName ||
      !normalizedEmail ||
      !trimmedPhone ||
      !trimmedOrganizationName
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create user
    const site = getSiteFromHeaders(req.headers);
    const existingUserId = await getUserIdFromEmail({ email: normalizedEmail, site });
    const userId =
      existingUserId ??
      (await createUser({ email: normalizedEmail, firstName: trimmedFirstName, site }));

    // Update/insert lead with all quote request data
    if (existingUserId) {
      await updateLeadInDb({
        userId,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone,
        organizationName: trimmedOrganizationName,
        websiteUrl: trimmedWebsiteUrl,
        comments: trimmedComments,
      });
    } else {
      await upsertLeadToDb({
        userId,
        email: normalizedEmail,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone,
        organizationName: trimmedOrganizationName,
        websiteUrl: trimmedWebsiteUrl,
        comments: trimmedComments,
      });
    }

    // Send Slack notification
    const isDemo = formType === "demo";
    try {
      await sendSlackWebhook([
        {
          color: isDemo ? "#3B82F6" : "#FF6B35",
          title: isDemo ? "📅 New Demo Request" : "🎯 New Quote Request",
          fields: [
            {
              title: "Name",
              value: `${firstName.trim()} ${lastName.trim()}`,
              short: true,
            },
            {
              title: "Organization",
              value: organizationName.trim(),
              short: true,
            },
            {
              title: "Email",
              value: email.trim().toLowerCase(),
              short: true,
            },
            {
              title: "Phone",
              value: phone.trim(),
              short: true,
            },
            ...(websiteUrl
              ? [
                  {
                    title: "Website",
                    value: websiteUrl.trim(),
                    short: false,
                  },
                ]
              : []),
            ...(comments
              ? [
                  {
                    title: "Comments",
                    value: comments.trim(),
                    short: false,
                  },
                ]
              : []),
          ],
          footer: `User ID: ${userId} • ${new Date().toLocaleString()}`,
        },
      ]);
    } catch (slackError) {
      console.error("Failed to send Slack notification:", slackError);
      // Don't fail the request if Slack fails
    }

    // Send Samantha's WhatsApp welcome message for demo requests (fire-and-forget)
    if (isDemo && trimmedPhone) {
      void sendLeadWelcome({
        phone: trimmedPhone,
        firstName: trimmedFirstName,
        templateName: "samantha_demo_welcome",
        templateBody:
          "Hi {{first_name}}! 👋 I'm Samantha from GovClerk.\n\nThank you for requesting a demo for {{organization_name}}! I'd love to help you see how we can streamline your meeting minutes process.\n\nBefore we schedule your demo, I have a few quick questions to make sure we tailor it perfectly for your needs. Ready to chat?",
        parameters: {
          first_name: trimmedFirstName,
          organization_name: trimmedOrganizationName,
        },
        leadSource: "demo_request",
        organizationName: trimmedOrganizationName,
        userId,
      });
    }

    await capture(
      "quote_request_submitted",
      {
        formType,
        userId,
        email: normalizedEmail,
        hasComments: Boolean(trimmedComments),
        hasWebsite: Boolean(trimmedWebsiteUrl),
        $session_id: posthogSessionId,
      },
      normalizedEmail
    );

    try {
      let metaConversionData = await readMetaConversionData(userId);

      if (metaConversionData == null) {
        const conversionEventData = getConversionEventDataFromEdgeRequest(req);
        await writeMetaConversionData({
          userId,
          email: normalizedEmail,
          firstName: trimmedFirstName,
          fbc: conversionEventData.fbc,
          fbp: conversionEventData.fbp,
          clientIpAddress: conversionEventData.clientIpAddress,
          clientUserAgent: conversionEventData.clientUserAgent,
        });
        metaConversionData = await readMetaConversionData(userId);
      }

      if (!metaConversionData?.sentCompleteRegistration) {
        const conversionEventData = getConversionEventDataFromEdgeRequest(req);
        await sendConversionEvent(
          {
            eventName: "CompleteRegistration",
            userId,
            email: normalizedEmail,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            ...conversionEventData,
          },
          {}
        );
      }
    } catch (conversionError) {
      console.error("Failed to send Meta CompleteRegistration event", conversionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: "Quote request submitted successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing quote request:", error);
    try {
      await capture(
        "quote_request_failed",
        {
          error: (error as Error)?.message ?? "unknown",
        },
        "anonymous"
      );
    } catch (captureError) {
      console.error("Failed to capture quote_request_failed event", captureError);
    }

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
