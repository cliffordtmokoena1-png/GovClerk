import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { MgAgendaItem, CreateAgendaItemInput, UpdateAgendaItemInput } from "@/types/agenda";

export const config = {
  runtime: "edge",
};

function rowToAgendaItem(row: any): MgAgendaItem {
  return {
    id: row.id,
    org_id: row.org_id,
    agenda_id: row.agenda_id,
    parent_id: row.parent_id ?? null,
    title: row.title,
    description: row.description,
    minutes: row.minutes,
    is_section: Boolean(row.is_section),
    ordinal: row.ordinal,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getAgendaForMeeting(
  conn: ReturnType<typeof getPortalDbConnection>,
  meetingId: string,
  orgId: string
) {
  const result = await conn.execute(
    "SELECT id FROM gc_agendas WHERE meeting_id = ? AND org_id = ?",
    [meetingId, orgId]
  );
  return result.rows[0] as { id: number } | undefined;
}

async function handlePost(
  meetingId: string,
  orgId: string,
  body: Omit<CreateAgendaItemInput, "org_id" | "agenda_id">
): Promise<Response> {
  const conn = getPortalDbConnection();

  const agenda = await getAgendaForMeeting(conn, meetingId, orgId);
  if (!agenda) {
    return errorResponse("Agenda not found for meeting", 404);
  }

  if (!body.title) {
    return errorResponse("Title is required", 400);
  }

  const result = await conn.execute(
    `INSERT INTO gc_agenda_items (org_id, agenda_id, parent_id, title, description, is_section, ordinal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      orgId,
      agenda.id,
      body.parent_id ?? null,
      body.title,
      body.description || null,
      body.is_section ? 1 : 0,
      body.ordinal ?? 0,
    ]
  );

  const newItem = await conn.execute(
    `SELECT id, org_id, agenda_id, parent_id, title, description, minutes, is_section, ordinal, created_at, updated_at
     FROM gc_agenda_items WHERE id = ?`,
    [result.insertId]
  );

  return jsonResponse({ item: rowToAgendaItem(newItem.rows[0]) }, 201);
}

async function handlePut(
  meetingId: string,
  orgId: string,
  body: UpdateAgendaItemInput & { itemId: number }
): Promise<Response> {
  const conn = getPortalDbConnection();

  if (!body.itemId) {
    return errorResponse("Item ID is required", 400);
  }

  const agenda = await getAgendaForMeeting(conn, meetingId, orgId);
  if (!agenda) {
    return errorResponse("Agenda not found for meeting", 404);
  }

  const existing = await conn.execute(
    "SELECT id FROM gc_agenda_items WHERE id = ? AND agenda_id = ? AND org_id = ?",
    [body.itemId, agenda.id, orgId]
  );

  if (existing.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(body.title);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.minutes !== undefined) {
    updates.push("minutes = ?");
    values.push(body.minutes);
  }
  if (body.is_section !== undefined) {
    updates.push("is_section = ?");
    values.push(body.is_section ? 1 : 0);
  }
  if (body.ordinal !== undefined) {
    updates.push("ordinal = ?");
    values.push(body.ordinal);
  }
  if (body.parent_id !== undefined) {
    updates.push("parent_id = ?");
    values.push(body.parent_id);
  }

  if (updates.length === 0) {
    return errorResponse("No fields to update", 400);
  }

  updates.push("updated_at = NOW()");
  values.push(body.itemId, agenda.id, orgId);

  await conn.execute(
    `UPDATE gc_agenda_items SET ${updates.join(", ")} WHERE id = ? AND agenda_id = ? AND org_id = ?`,
    values
  );

  const updated = await conn.execute(
    `SELECT id, org_id, agenda_id, parent_id, title, description, minutes, is_section, ordinal, created_at, updated_at
     FROM gc_agenda_items WHERE id = ?`,
    [body.itemId]
  );

  return jsonResponse({ item: rowToAgendaItem(updated.rows[0]) });
}

async function handleDelete(meetingId: string, orgId: string, itemId: number): Promise<Response> {
  const conn = getPortalDbConnection();

  const agenda = await getAgendaForMeeting(conn, meetingId, orgId);
  if (!agenda) {
    return errorResponse("Agenda not found for meeting", 404);
  }

  const existing = await conn.execute(
    "SELECT id FROM gc_agenda_items WHERE id = ? AND agenda_id = ? AND org_id = ?",
    [itemId, agenda.id, orgId]
  );

  if (existing.rows.length === 0) {
    return errorResponse("Agenda item not found", 404);
  }

  await conn.execute("DELETE FROM gc_agenda_items WHERE id = ? AND agenda_id = ? AND org_id = ?", [
    itemId,
    agenda.id,
    orgId,
  ]);

  return jsonResponse({ success: true });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const agendaItemsIndex = pathParts.indexOf("agenda-items");
  const meetingId = pathParts[agendaItemsIndex - 1];

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "POST") {
    return handlePost(meetingId, orgId, body);
  }

  if (req.method === "PUT") {
    return handlePut(meetingId, orgId, body);
  }

  if (req.method === "DELETE") {
    const itemId = body.itemId || url.searchParams.get("itemId");
    if (!itemId) {
      return errorResponse("Item ID is required", 400);
    }
    return handleDelete(meetingId, orgId, Number(itemId));
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
