import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";

import withErrorReporting from "@/error/withErrorReporting";
import { Template } from "@/types/Template";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { ALL_TEMPLATES } from "@/templates/minutes-library";

type TemplatesApiResponse = {
  templates: Template[];
};

const PLANETSCALE_CONFIG = {
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
};

// Fetch custom user/org templates from the database.
// Built-in templates are served from the TypeScript library directly.
async function fetchCustomTemplates(
  userId: string,
  orgId: string | null
): Promise<Template[]> {
  const conn = connect(PLANETSCALE_CONFIG);

  let query: string;
  let params: (string | null)[];

  if (orgId) {
    query = `
      SELECT
        template_id,
        user_id,
        org_id,
        name,
        description,
        category,
        content,
        preview,
        use_case,
        advantages
      FROM gc_templating
      WHERE is_default = 0 AND org_id = ?
      ORDER BY created_at DESC
    `;
    params = [orgId];
  } else {
    query = `
      SELECT
        template_id,
        user_id,
        org_id,
        name,
        description,
        category,
        content,
        preview,
        use_case,
        advantages
      FROM gc_templating
      WHERE is_default = 0 AND user_id = ? AND org_id IS NULL
      ORDER BY created_at DESC
    `;
    params = [userId];
  }

  const result = await conn.execute<{
    template_id: string;
    user_id: string | null;
    org_id: string | null;
    name: string;
    description: string | null;
    category: string;
    content: string;
    preview: string | null;
    use_case: string | null;
    advantages: string | null;
  }>(query, params);

  return result.rows.map((row) => {
    let parsedAdvantages: string[] = [];

    if (row.advantages) {
      try {
        const parsed = JSON.parse(row.advantages);
        if (Array.isArray(parsed)) {
          parsedAdvantages = parsed.map((item) => String(item));
        }
      } catch {
        // advantages is not valid JSON — use empty array as fallback
        parsedAdvantages = [];
      }
    }

    return {
      id: row.template_id,
      name: row.name,
      description: row.description ?? "",
      category: row.category as Template["category"],
      preview: row.preview ?? "",
      content: row.content,
      useCase: row.use_case ?? "",
      advantages: parsedAdvantages,
      isCustom: true,
    };
  });
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TemplatesApiResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = getAuth(req);
  if (auth.userId == null) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orgIdParam = req.query.orgId as string | undefined;
  const { userId, orgId } = await resolveRequestContext(auth.userId, orgIdParam, req.headers);

  // Always include built-in library templates
  const builtInTemplates: Template[] = ALL_TEMPLATES.map((template) => ({
    ...template,
    isCustom: false,
  }));

  // Fetch custom templates from DB, gracefully handling errors if the table
  // does not exist or is unavailable
  let customTemplates: Template[] = [];
  try {
    customTemplates = await fetchCustomTemplates(userId, orgId);
  } catch (error) {
    // If the DB query fails (e.g. table not yet created), return only built-ins
    console.error("[templates] Failed to fetch custom templates from DB:", error);
  }

  // Deduplicate: custom templates override built-ins with the same ID
  const customIds = new Set(customTemplates.map((t) => t.id));
  const templates: Template[] = [
    ...builtInTemplates.filter((t) => !customIds.has(t.id)),
    ...customTemplates,
  ];

  return res.status(200).json({ templates });
}

export default withErrorReporting(handler);
