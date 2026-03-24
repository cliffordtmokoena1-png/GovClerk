import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type {
  AgendaTemplate,
  CreateAgendaTemplateRequest,
  CreateAgendaTemplateResponse,
  AgendaTemplatesResponse,
} from "@/types/agenda";
import type { MgAgendaItemWithRelations } from "@/types/agenda";

export const config = {
  runtime: "edge",
};

function rowToAgendaTemplate(row: any): AgendaTemplate {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    description: row.description,
    template_data:
      typeof row.template_data === "string" ? JSON.parse(row.template_data) : row.template_data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function convertAgendaItemsToTemplate(items: MgAgendaItemWithRelations[]): any {
  return {
    items: items.map((item) => ({
      title: item.title,
      description: item.description || undefined,
      is_section: item.is_section,
      children:
        item.children && item.children.length > 0
          ? convertAgendaItemsToTemplate(item.children).items
          : undefined,
    })),
  };
}

async function handleGet(orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const templatesResult = await conn.execute(
    "SELECT id, org_id, name, description, template_data, created_at, updated_at " +
      "FROM gc_agenda_templates WHERE org_id = ? ORDER BY updated_at DESC",
    [orgId]
  );

  const templates = templatesResult.rows.map(rowToAgendaTemplate);

  const response: AgendaTemplatesResponse = {
    templates,
  };

  return jsonResponse(response);
}

async function handlePost(
  orgId: string,
  body: CreateAgendaTemplateRequest & {
    meetingId?: number;
    agendaItems?: MgAgendaItemWithRelations[];
  }
): Promise<Response> {
  const conn = getPortalDbConnection();

  if (!body.name || body.name.trim().length === 0) {
    return errorResponse("Template name is required", 400);
  }

  let templateData: any;

  if (body.meetingId && body.agendaItems) {
    // Save current agenda as template
    templateData = convertAgendaItemsToTemplate(body.agendaItems);
  } else if (body.meetingId) {
    // Fetch agenda items from meeting and save as template
    const agendaResult = await conn.execute(
      "SELECT id FROM gc_agendas WHERE meeting_id = ? AND org_id = ?",
      [body.meetingId, orgId]
    );

    if (agendaResult.rows.length === 0) {
      return errorResponse("Meeting agenda not found", 404);
    }

    const agendaId = agendaResult.rows[0].id;

    const itemsResult = await conn.execute(
      "SELECT id, org_id, agenda_id, parent_id, title, description, minutes, is_section, ordinal, created_at, updated_at " +
        "FROM gc_agenda_items WHERE agenda_id = ? AND org_id = ? ORDER BY ordinal",
      [agendaId, orgId]
    );

    // Build hierarchy
    const itemMap = new Map<number, any>();
    const rootItems: any[] = [];

    // First pass: create map of all items
    for (const row of itemsResult.rows) {
      itemMap.set(row.id, { ...row, children: [] });
    }

    // Second pass: build tree structure
    for (const row of itemsResult.rows) {
      const item = itemMap.get(row.id)!;
      if (item.parent_id === null) {
        rootItems.push(item);
      } else {
        const parent = itemMap.get(item.parent_id);
        if (parent) {
          parent.children.push(item);
        } else {
          // Orphaned item, treat as root
          rootItems.push(item);
        }
      }
    }

    templateData = convertAgendaItemsToTemplate(rootItems);
  } else {
    return errorResponse("Either meetingId and agendaItems or meetingId alone is required", 400);
  }

  const result = await conn.execute(
    "INSERT INTO gc_agenda_templates (org_id, name, description, template_data) VALUES (?, ?, ?, ?)",
    [orgId, body.name.trim(), body.description?.trim() || null, JSON.stringify(templateData)]
  );

  const insertId = Number(result.insertId);

  // Fetch the created template
  const createdTemplateResult = await conn.execute(
    "SELECT id, org_id, name, description, template_data, created_at, updated_at " +
      "FROM gc_agenda_templates WHERE id = ?",
    [insertId]
  );

  if (createdTemplateResult.rows.length === 0) {
    return errorResponse("Failed to create template", 500);
  }

  const response: CreateAgendaTemplateResponse = {
    template: rowToAgendaTemplate(createdTemplateResult.rows[0]),
  };

  return jsonResponse(response, 201);
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(orgId);
  }

  if (req.method === "POST") {
    return handlePost(orgId, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
