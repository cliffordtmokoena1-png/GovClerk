/**
 * GET  /api/portal/admin/retention — list retention records for org's artifacts
 * POST /api/portal/admin/retention — set retention info for an artifact
 * Requires Clerk auth.
 */
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";
import { getPortalDbConnection } from "@/utils/portalDb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, orgId } = getAuth(req);
  if (!userId || !orgId) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      `SELECT dr.id, dr.artifact_id, dr.document_type, dr.retention_period,
              dr.retention_basis, dr.destruction_date, dr.is_permanent, dr.created_at,
              a.file_name, a.artifact_type
       FROM gc_document_retention dr
       LEFT JOIN gc_artifacts a ON a.id = dr.artifact_id
       WHERE dr.org_id = ?
       ORDER BY dr.created_at DESC`,
      [orgId]
    );

    return res.status(200).json({ retention: result.rows });
  }

  if (req.method === "POST") {
    const { artifactId, documentType, retentionPeriod, retentionBasis, destructionDate, isPermanent } = req.body as {
      artifactId?: number;
      documentType?: string;
      retentionPeriod?: string;
      retentionBasis?: string;
      destructionDate?: string;
      isPermanent?: boolean;
    };

    if (!documentType || !retentionPeriod) {
      return res.status(400).json({ error: "documentType and retentionPeriod are required" });
    }

    const insertRes = await conn.execute(
      `INSERT INTO gc_document_retention
       (org_id, artifact_id, document_type, retention_period, retention_basis, destruction_date, is_permanent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        artifactId || null,
        documentType,
        retentionPeriod,
        retentionBasis || null,
        destructionDate || null,
        isPermanent ? 1 : 0,
      ]
    );

    return res.status(201).json({ success: true, id: (insertRes as any).insertId });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
