import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import type { GeneratedAgendaItem } from "@/types/agenda";

export const config = {
  runtime: "edge",
};

interface GenerateAgendaRequest {
  context: string;
  orgId: string;
}

interface GenerateAgendaResponse {
  items: GeneratedAgendaItem[];
}

const SYSTEM_PROMPT = `You are a meeting agenda generator. Given context about a meeting, generate a structured agenda that follows the natural flow of the topics provided.

Output a JSON object with an "items" array. Each item should have:
- "title": string (the agenda item title)
- "description": string (optional, brief description)
- "is_section": boolean (true if this is a section header)
- "motions": array of motion objects (optional, for items requiring decisions or approvals)
  - Each motion should have: "title" (required), "mover" (optional), "seconder" (optional)
- "children": array of nested items (optional, same structure)

Generate the agenda based on the context provided, maintaining a logical structure with sections as needed. Include placeholder motions for agenda items that typically require decisions or approvals, such as "Approval of Minutes", "Budget Approval", "Policy Decisions", "Elections", or similar items that require formal voting. Motions should be concise and action-oriented. Only output valid JSON, no markdown or explanations.`;

async function insertAgendaItemsWithMotions(
  conn: ReturnType<typeof getPortalDbConnection>,
  items: GeneratedAgendaItem[],
  agendaId: number,
  meetingId: string,
  orgId: string,
  parentId: number | null = null
): Promise<void> {
  for (const item of items) {
    // Insert agenda item
    const insertItemResult = await conn.execute(
      `INSERT INTO gc_agenda_items
       (org_id, agenda_id, parent_id, title, description, is_section, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        agendaId,
        parentId,
        item.title,
        item.description || null,
        item.is_section,
        1, // Will be updated later with proper ordinal
      ]
    );

    const newItemId = Number(insertItemResult.insertId);

    // Create motions for this agenda item if they exist and it's not a section
    if (!item.is_section && item.motions && item.motions.length > 0) {
      for (const motion of item.motions) {
        if (!motion.title.trim()) {
          continue; // Skip empty motion titles
        }

        try {
          await conn.execute(
            `INSERT INTO gc_motions (org_id, agenda_item_id, title, description, mover, seconder, is_withdrawn, is_tabled, ordinal, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, NOW(), NOW())`,
            [
              orgId,
              newItemId,
              motion.title,
              motion.description || null,
              motion.mover || null,
              motion.seconder || null,
              1, // Will be auto-calculated by the motion API logic
            ]
          );
        } catch (error) {
          console.error(
            `Error creating motion "${motion.title}" for agenda item ${newItemId}:`,
            error
          );
        }
      }
    }

    // Insert children if any
    if (item.children && item.children.length > 0) {
      await insertAgendaItemsWithMotions(
        conn,
        item.children,
        agendaId,
        meetingId,
        orgId,
        newItemId
      );
    }
  }
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
  // Path: /api/portal/meetings/[id]/generate-agenda
  const meetingId = pathParts[pathParts.length - 2];

  if (!meetingId) {
    return errorResponse("Meeting ID is required", 400);
  }

  const body: GenerateAgendaRequest = await req.json().catch(() => ({ context: "", orgId: "" }));
  const { context, orgId: bodyOrgId } = body;

  if (!context || context.trim().length === 0) {
    return errorResponse("Context is required", 400);
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

  const meeting = meetingResult.rows[0] as { id: number; title: string };

  // Call OpenRouter API
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return errorResponse("OpenRouter API key not configured", 500);
  }

  try {
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterApiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://GovClerkMinutes.com",
        "X-Title": "Minutes Generator",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Generate a meeting agenda for "${meeting.title}" based on the following context:\n\n${context}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error("OpenRouter error:", errorText);
      return errorResponse("Failed to generate agenda", 500);
    }

    const aiResult = await openRouterResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse("No content in AI response", 500);
    }

    // Parse the JSON response
    let generatedAgenda: GenerateAgendaResponse;
    try {
      generatedAgenda = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return errorResponse("Invalid AI response format", 500);
    }

    // Validate the response structure
    if (!generatedAgenda.items || !Array.isArray(generatedAgenda.items)) {
      return errorResponse("Invalid agenda structure", 500);
    }

    // Get or create agenda for the meeting
    let agendaResult = await conn.execute(
      "SELECT id FROM gc_agendas WHERE meeting_id = ? AND org_id = ?",
      [meetingId, orgId]
    );

    let agendaId: number;

    if (agendaResult.rows.length === 0) {
      // Create agenda if it doesn't exist
      const createAgendaResult = await conn.execute(
        "INSERT INTO gc_agendas (org_id, meeting_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
        [orgId, meetingId]
      );
      agendaId = Number(createAgendaResult.insertId);
    } else {
      agendaId = agendaResult.rows[0].id;

      // Delete existing agenda items and their motions (cascade delete should handle motions)
      await conn.execute("DELETE FROM gc_agenda_items WHERE agenda_id = ? AND org_id = ?", [
        agendaId,
        orgId,
      ]);
    }

    // Insert agenda items with motions
    try {
      await insertAgendaItemsWithMotions(
        conn,
        generatedAgenda.items,
        agendaId,
        meetingId.toString(),
        orgId
      );
    } catch (error) {
      console.error("Error inserting agenda items with motions:", error);
      // Continue without failing - agenda structure was still generated
    }

    return jsonResponse(generatedAgenda);
  } catch (error) {
    console.error("Agenda generation error:", error);
    return errorResponse("Failed to generate agenda", 500);
  }
}

export default withErrorReporting(handler);
