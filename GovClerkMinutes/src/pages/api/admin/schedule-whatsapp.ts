import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { assertString } from "@/utils/assert";
import { connect } from "@planetscale/database";
import { convertIsoTimestampForMysql } from "@/utils/date";
import hubspot from "@/crm/hubspot";
import type { ScheduleWhatsappRequestPayload } from "@/admin/whatsapp/types";
import { assertSource } from "@/admin/whatsapp/utils";

export const config = {
  runtime: "edge",
};

async function logHubspotTask(
  adminUserId: string,
  sendAt: string,
  whatsappId: string
): Promise<void> {
  let contact = await hubspot.getContact({
    filter: {
      propertyName: "phone",
      value: `+${whatsappId}`,
    },
    returnedProperties: ["firstname", "email", "phone"],
  });

  const currentTime = new Date();
  const nycTime = currentTime.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "short",
    timeStyle: "short",
  });
  const southAfricaTime = currentTime.toLocaleString("en-US", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "short",
    timeStyle: "short",
  });

  const ownerId = (await hubspot.getOwnerIdFromUserId(adminUserId)) ?? undefined;

  const taskId = await hubspot.createTask({
    taskSubject: `Follow up with ${contact?.properties["firstname"] ?? "lead"} on WhatsApp`,
    taskBody: `Follow up scheduled by admin at:<br>NYC: ${nycTime}<br>South Africa: ${southAfricaTime}`,
    taskDueDate: new Date(sendAt),
    taskType: "TODO",
    ownerId,
  });

  if (contact != null) {
    await hubspot.associateContactWithTask({
      contactId: contact.id,
      taskId,
    });
  }
}

async function handler(req: NextRequest) {
  const { userId: adminUserId, sessionClaims } = getAuth(req);
  if (!adminUserId || !sessionClaims?.metadata?.role || sessionClaims.metadata.role !== "admin") {
    return new Response(null, { status: 401 });
  }

  try {
    const body = (await req.json()) as ScheduleWhatsappRequestPayload;

    const sendAt = assertString(body.sendAt as string);
    const whatsappId = assertString(
      (body.whatsappId as string)?.replace(/^\+/, "").replace(/[^0-9]/g, "")
    );
    const mode = body.mode;
    const makeHubspotTask = Boolean(body.makeHubspotTask);
    const cancelOnReply = Boolean(body.cancelOnReply);
    const source = assertSource(body.source);
    const businessWhatsappId = body.businessWhatsappId;

    const conn = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    if (mode === "freeform") {
      await conn.execute(
        `
        INSERT INTO gc_scheduled_whatsapps
        (whatsapp_id, business_whatsapp_id, freeform, send_at, sender_user_id, mode, cancel_on_reply, source)
        VALUES (?, ?, ?, ?, ?, "freeform_tool", ?, ?)
        `,
        [
          whatsappId,
          businessWhatsappId,
          body.text,
          convertIsoTimestampForMysql(sendAt),
          adminUserId,
          cancelOnReply ? 1 : 0,
          source,
        ]
      );
    } else {
      const templateName = assertString(body.templateName);
      const templateBody = assertString(body.templateBody);
      const templateVariables = body.templateVariables ?? "{}";
      const language = body.language;

      await conn.execute(
        `
      INSERT INTO gc_scheduled_whatsapps
      (whatsapp_id, business_whatsapp_id, template_id, variables, send_at, sender_user_id, mode, cancel_on_reply, source, language, template_body)
      VALUES (?, ?, ?, ?, ?, ?, "tool", ?, ?, ?, ?)
      `,
        [
          whatsappId,
          businessWhatsappId,
          templateName,
          templateVariables,
          convertIsoTimestampForMysql(sendAt),
          adminUserId,
          cancelOnReply ? 1 : 0,
          source,
          language,
          templateBody,
        ]
      );
    }

    if (makeHubspotTask) {
      await logHubspotTask(adminUserId, sendAt, whatsappId);
    }

    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[admin/schedule-whatsapp] Handler error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default withErrorReporting(handler);
