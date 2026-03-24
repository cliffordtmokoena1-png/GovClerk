import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { connect } from "@planetscale/database";

import withErrorReporting from "@/error/withErrorReporting";
import { capture } from "@/utils/posthog";
import { resolveRequestContext } from "@/utils/resolveRequestContext";

const PLANETSCALE_CONFIG = {
  host: process.env.PLANETSCALE_DB_HOST,
  username: process.env.PLANETSCALE_DB_USERNAME,
  password: process.env.PLANETSCALE_DB_PASSWORD,
};

type DeleteTemplateResponse = { success: true } | { success: false; error: string };

async function handler(req: NextApiRequest, res: NextApiResponse<DeleteTemplateResponse>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const auth = getAuth(req);
  if (auth.userId == null) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const templateId = body?.templateId as string | undefined;

  if (!templateId || typeof templateId !== "string") {
    return res.status(400).json({ success: false, error: "templateId is required" });
  }

  const { userId, orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  const conn = connect(PLANETSCALE_CONFIG);

  let deleteQuery: string;
  let deleteParams: string[];

  if (orgId) {
    deleteQuery = "DELETE FROM gc_templating WHERE template_id = ? AND org_id = ?";
    deleteParams = [templateId, orgId];
  } else {
    deleteQuery =
      "DELETE FROM gc_templating WHERE template_id = ? AND user_id = ? AND org_id IS NULL";
    deleteParams = [templateId, userId];
  }

  const deleteResult = await conn.execute(deleteQuery, deleteParams);

  if (!deleteResult.rowsAffected || deleteResult.rowsAffected === 0) {
    return res.status(404).json({ success: false, error: "Template not found" });
  }

  const settingsResult = await conn.execute<{ setting_value: string }>(
    "SELECT setting_value FROM gc_settings WHERE user_id = ? AND setting_key = 'selected-template-id' LIMIT 1",
    [userId]
  );

  const currentSetting = settingsResult.rows?.[0]?.setting_value;
  let shouldResetSelection = false;

  if (currentSetting) {
    try {
      const parsed = JSON.parse(currentSetting) as string | null;
      shouldResetSelection = parsed === templateId;
    } catch (error) {
      shouldResetSelection = false;
    }
  }

  if (shouldResetSelection) {
    const defaultTemplateValue = JSON.stringify("GovClerkMinutes-template");
    await conn.execute(
      `INSERT INTO gc_settings (user_id, setting_key, setting_value)
       VALUES (?, 'selected-template-id', ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, defaultTemplateValue]
    );
  }

  await capture(
    "custom_template_deleted",
    {
      template_id: templateId,
    },
    userId
  );

  return res.status(200).json({ success: true });
}

export default withErrorReporting(handler);
