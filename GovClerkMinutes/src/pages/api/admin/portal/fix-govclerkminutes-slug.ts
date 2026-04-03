/**
 * One-time admin migration endpoint.
 *
 * POST /api/admin/portal/fix-govclerkminutes-slug
 *
 * Updates gc_portal_settings rows that still have slug='demo' or
 * page_title containing 'Demo' to use the correct GovClerkMinutes values.
 *
 * Authentication: secret header x-admin-secret must match ADMIN_SECRET env var.
 * Idempotent: safe to run multiple times.
 */

import { NextRequest } from "next/server";
import { getPortalDbConnection } from "@/utils/portalDb";
import { jsonResponse, errorResponse } from "@/utils/apiHelpers";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Authenticate via secret header
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return errorResponse("Server misconfiguration: ADMIN_SECRET not set", 500);
  }
  const providedSecret = req.headers.get("x-admin-secret");
  if (!providedSecret || providedSecret !== adminSecret) {
    return errorResponse("Unauthorized", 401);
  }

  const conn = getPortalDbConnection();

  // Update all rows where slug='demo' OR page_title LIKE '%Demo%'
  // Sets slug='govclerkminutes' and page_title='GovClerkMinutes Portal'
  const updateResult = await conn.execute(
    `UPDATE gc_portal_settings
     SET slug = 'govclerkminutes',
         page_title = 'GovClerkMinutes Portal'
     WHERE slug = 'demo'
        OR page_title LIKE '%Demo%'`,
    []
  );

  const rowsAffected = (updateResult as any).rowsAffected ?? 0;

  return jsonResponse({
    success: true,
    rowsAffected,
    message:
      rowsAffected > 0
        ? `Updated ${rowsAffected} row(s): slug='govclerkminutes', page_title='GovClerkMinutes Portal'`
        : "No rows matched the criteria (already updated or not found)",
  });
}
