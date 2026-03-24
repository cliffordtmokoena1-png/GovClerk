import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection, rowToPortalArtifact } from "@/utils/portalDb";
import type {
  MgAgenda,
  MgAgendaItem,
  MgAgendaItemWithRelations,
  MgAgendaWithItems,
  ReorderAgendaItemsInput,
  MgMotion,
} from "@/types/agenda";
import type { PortalArtifact } from "@/types/portal";

export const config = {
  runtime: "edge",
};

function rowToAgenda(row: any): MgAgenda {
  return {
    id: row.id,
    org_id: row.org_id,
    meeting_id: row.meeting_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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

function rowToMotion(row: any): MgMotion {
  return {
    id: row.id,
    org_id: row.org_id,
    agenda_item_id: row.agenda_item_id,
    title: row.title,
    description: row.description,
    mover: row.mover,
    seconder: row.seconder,
    is_withdrawn: Boolean(row.is_withdrawn),
    is_tabled: Boolean(row.is_tabled),
    ordinal: row.ordinal,
    created_at: row.created_at,
    updated_at: row.updated_at,
    votes_for: row.votes_for ?? 0,
    votes_against: row.votes_against ?? 0,
    votes_abstain: row.votes_abstain ?? 0,
  };
}

async function getOrCreateAgenda(
  conn: ReturnType<typeof getPortalDbConnection>,
  meetingId: string,
  orgId: string
): Promise<MgAgenda> {
  const existing = await conn.execute(
    `SELECT id, org_id, meeting_id, created_at, updated_at
     FROM gc_agendas WHERE meeting_id = ? AND org_id = ?`,
    [meetingId, orgId]
  );

  if (existing.rows.length > 0) {
    return rowToAgenda(existing.rows[0]);
  }

  const result = await conn.execute(
    `INSERT INTO gc_agendas (org_id, meeting_id, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW())`,
    [orgId, meetingId]
  );

  const newAgenda = await conn.execute(
    `SELECT id, org_id, meeting_id, created_at, updated_at
     FROM gc_agendas WHERE id = ?`,
    [result.insertId]
  );

  return rowToAgenda(newAgenda.rows[0]);
}

async function handleGet(meetingId: string, orgId: string): Promise<Response> {
  const conn = getPortalDbConnection();

  const meetingCheck = await conn.execute(
    "SELECT id FROM gc_meetings WHERE id = ? AND org_id = ?",
    [meetingId, orgId]
  );

  if (meetingCheck.rows.length === 0) {
    return errorResponse("Meeting not found", 404);
  }

  const agenda = await getOrCreateAgenda(conn, meetingId, orgId);

  const itemsResult = await conn.execute(
    `SELECT id, org_id, agenda_id, parent_id, title, description, minutes, is_section, ordinal, created_at, updated_at
     FROM gc_agenda_items WHERE agenda_id = ? ORDER BY ordinal ASC`,
    [agenda.id]
  );

  const items = itemsResult.rows.map(rowToAgendaItem);

  // Fetch artifacts for all agenda items
  const itemIds = items.map((item) => item.id);
  let artifactsMap: Map<number, PortalArtifact[]> = new Map();
  let motionsMap: Map<number, MgMotion[]> = new Map();

  if (itemIds.length > 0) {
    // Fetch artifacts
    const artifactsResult = await conn.execute(
      `SELECT ma.*, maia.agenda_item_id, maia.ordinal as attachment_ordinal
       FROM gc_agenda_artifacts_group maia
       JOIN gc_artifacts ma ON maia.artifact_id = ma.id
       WHERE maia.agenda_item_id IN (${itemIds.map(() => "?").join(",")})
       ORDER BY maia.ordinal ASC`,
      itemIds
    );

    // Group artifacts by agenda item ID
    for (const row of artifactsResult.rows as any[]) {
      const itemId = row.agenda_item_id;
      if (!artifactsMap.has(itemId)) {
        artifactsMap.set(itemId, []);
      }
      artifactsMap.get(itemId)!.push(rowToPortalArtifact(row));
    }

    // Fetch motions with computed vote counts
    const motionsResult = await conn.execute(
      `SELECT m.id, m.org_id, m.agenda_item_id, m.title, m.description, m.mover, m.seconder,
       m.is_withdrawn, m.is_tabled, m.ordinal, m.created_at, m.updated_at,
       (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'yes') as votes_for,
       (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'no') as votes_against,
       (SELECT COUNT(*) FROM gc_votes v WHERE v.motion_id = m.id AND v.vote_value = 'abstain') as votes_abstain
       FROM gc_motions m WHERE m.agenda_item_id IN (${itemIds.map(() => "?").join(",")})
       ORDER BY m.ordinal ASC`,
      itemIds
    );

    // Group motions by agenda item ID
    for (const row of motionsResult.rows as any[]) {
      const itemId = row.agenda_item_id;
      if (!motionsMap.has(itemId)) {
        motionsMap.set(itemId, []);
      }
      motionsMap.get(itemId)!.push(rowToMotion(row));
    }
  }

  // Attach artifacts and motions to items
  const itemsWithArtifacts: MgAgendaItemWithRelations[] = items.map((item) => ({
    ...item,
    artifacts: artifactsMap.get(item.id) ?? [],
    motions: motionsMap.get(item.id) ?? [],
  }));

  const response: MgAgendaWithItems = {
    ...agenda,
    items: itemsWithArtifacts,
  };

  return jsonResponse({ agenda: response });
}

async function handlePut(
  meetingId: string,
  orgId: string,
  body: ReorderAgendaItemsInput
): Promise<Response> {
  const conn = getPortalDbConnection();

  if (!body.items || !Array.isArray(body.items)) {
    return errorResponse("Items array is required", 400);
  }

  const agenda = await getOrCreateAgenda(conn, meetingId, orgId);

  await conn.transaction(async (tx) => {
    for (const item of body.items) {
      if (item.parent_id !== undefined) {
        await tx.execute(
          `UPDATE gc_agenda_items SET ordinal = ?, parent_id = ?, updated_at = NOW()
           WHERE id = ? AND agenda_id = ? AND org_id = ?`,
          [item.ordinal, item.parent_id, item.id, agenda.id, orgId]
        );
      } else {
        await tx.execute(
          `UPDATE gc_agenda_items SET ordinal = ?, updated_at = NOW()
           WHERE id = ? AND agenda_id = ? AND org_id = ?`,
          [item.ordinal, item.id, agenda.id, orgId]
        );
      }
    }
  });

  const itemsResult = await conn.execute(
    `SELECT id, org_id, agenda_id, parent_id, title, description, minutes, is_section, ordinal, created_at, updated_at
     FROM gc_agenda_items WHERE agenda_id = ? ORDER BY ordinal ASC`,
    [agenda.id]
  );

  const response: MgAgendaWithItems = {
    ...agenda,
    items: itemsResult.rows.map(rowToAgendaItem),
  };

  return jsonResponse({ agenda: response });
}

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const agendaIndex = pathParts.indexOf("agenda");
  const meetingId = pathParts[agendaIndex - 1];

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const orgIdParam = req.method === "GET" ? url.searchParams.get("orgId") : body.orgId;

  const { orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  if (req.method === "GET") {
    return handleGet(meetingId, orgId);
  }

  if (req.method === "PUT") {
    return handlePut(meetingId, orgId, body);
  }

  return errorResponse("Method not allowed", 405);
}

export default withErrorReporting(handler);
