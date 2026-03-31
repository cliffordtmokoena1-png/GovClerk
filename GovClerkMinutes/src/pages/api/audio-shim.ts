import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { getPresignedGetterLink } from "./s3";
import { getUploadKey } from "@/utils/s3";
import { strictParseInt } from "@/utils/number";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { canAccessResourceWithOrgId } from "@/utils/resourceAccess";
import { getSiteFromHeaders } from "@/utils/site";

interface TranscriptRow {
  aws_region: string | null;
  s3AudioKey: string | null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).end();
  }

  const transcriptId = strictParseInt(req.query.tid);

  const site = getSiteFromHeaders(req.headers);
  const accessResult = await canAccessResourceWithOrgId("transcripts", transcriptId, userId, site);

  if (!accessResult.hasAccess) {
    return res.status(403).json({ error: "Access denied" });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute("SELECT aws_region, s3AudioKey FROM transcripts WHERE id = ?;", [transcriptId])
    .then((res) => res.rows as TranscriptRow[]);

  if (!rows[0]) {
    return res.status(404).json({ error: "Transcript not found" });
  }

  const region = rows[0]?.aws_region;

  if (!region) {
    return res.status(404).json({ error: "Audio not available" });
  }

  // Use the actual S3 key stored in the database, falling back to the computed key
  // for older transcripts that may not have s3AudioKey populated
  const s3Key = rows[0].s3AudioKey || getUploadKey(transcriptId);

  const forwardLink = await getPresignedGetterLink(region, s3Key);

  res.status(302).redirect(forwardLink);
}

export default withErrorReporting(handler);
