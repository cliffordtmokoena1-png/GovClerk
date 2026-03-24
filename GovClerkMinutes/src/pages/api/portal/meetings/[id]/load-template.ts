import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type {
  LoadTemplateRequest,
  LoadTemplateResponse,
  GeneratedAgendaItem,
} from "@/types/agenda";

export const config = {
  runtime: "edge",
};

// Convert template items to generated agenda items format
function convertTemplateToGeneratedAgenda(templateItems: any[]): GeneratedAgendaItem[] {
  return templateItems.map((item) => ({
    title: item.title,
    description: item.description,
    is_section: item.is_section,
    motions: item.motions || [],
    children:
      item.children && item.children.length > 0
        ? convertTemplateToGeneratedAgenda(item.children)
        : undefined,
  }));
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/portal/meetings/[id]/load-template
  const meetingId = pathParts[pathParts.length - 2];

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body: LoadTemplateRequest = await req.json().catch(() => ({ templateId: 0, orgId: "" }));
  const { templateId, orgId: bodyOrgId } = body;

  if (!templateId) {
    return errorResponse("Template ID is required", 400);
  }

  const { orgId } = await resolveRequestContext(auth.userId, bodyOrgId, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  // Verify meeting exists and belongs to org
  const meetingResult = await conn.execute(
    "SELECT id, title FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingResult.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  // Verify template exists and belongs to org
  const templateResult = await conn.execute(
    "SELECT id, org_id, name, description, template_data, created_at, updated_at " +
      "FROM gc_agenda_templates WHERE id = ? AND org_id = ?",
    [templateId, orgId]
  );

  if (templateResult.rows.length === 0) {
    return errorResponse("Template not found", 404);
  }

  const template = templateResult.rows[0];
  const templateData =
    typeof template.template_data === "string"
      ? JSON.parse(template.template_data)
      : template.template_data;

  // Get or create agenda for the meeting
  let agendaResult = await conn.execute(
    "SELECT id FROM gc_agendas WHERE meeting_id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  let agendaId: number;

  if (agendaResult.rows.length === 0) {
    // Create agenda if it doesn't exist
    const createAgendaResult = await conn.execute(
      "INSERT INTO gc_agendas (org_id, meeting_id) VALUES (?, ?)",
      [orgId, meetingId]
    );
    agendaId = Number(createAgendaResult.insertId);
  } else {
    agendaId = agendaResult.rows[0].id;

    // Delete existing agenda items
    await conn.execute("DELETE FROM gc_agenda_items WHERE agenda_id = ? AND org_id = ?", [
      agendaId,
      orgId,
    ]);
  }

  // Convert template items to agenda items and insert them
  const insertItems = async (
    items: GeneratedAgendaItem[],
    parentId: number | null = null,
    ordinal: number = 1
  ): Promise<void> => {
    for (const item of items) {
      const insertItemResult = await conn.execute(
        `INSERT INTO gc_agenda_items 
         (org_id, agenda_id, parent_id, title, description, is_section, ordinal) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orgId, agendaId, parentId, item.title, item.description || null, item.is_section, ordinal]
      );

      const newItemId = Number(insertItemResult.insertId);

      // Insert children if any
      if (item.children && item.children.length > 0) {
        await insertItems(item.children, newItemId, 1);
      }

      ordinal++;
    }
  };

  await insertItems(convertTemplateToGeneratedAgenda(templateData.items || []));

  const response: LoadTemplateResponse = {
    items: convertTemplateToGeneratedAgenda(templateData.items || []),
  };

  return jsonResponse(response);
}

export default withErrorReporting(handler);
