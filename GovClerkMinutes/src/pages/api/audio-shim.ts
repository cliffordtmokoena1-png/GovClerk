import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { getPresignedGetterLink } from "./s3";
import { getUploadKey } from "@/utils/s3";
import { strictParseInt } from "@/utils/number";
import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { canAccessResourceWithOrgId } from "@/utils/resourceAccess";
import { getSiteFromRequest } from "@/utils/site";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (userId == null) {
    return res.status(401).end();
  }

  const transcriptId = strictParseInt(req.query.tid);

  const site = getSiteFromRequest(req.headers);
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
    .execute("SELECT aws_region FROM transcripts WHERE id = ?;", [transcriptId])
    .then((res) => res.rows);

  if (!rows[0]) {
    return res.status(404).json({ error: "Transcript not found" });
  }

  const region = rows[0]?.aws_region;

  if (!region) {
    return res.status(404).json({ error: "Audio not available" });
  }

  const forwardLink = await getPresignedGetterLink(region, getUploadKey(transcriptId));

  res.status(302).redirect(forwardLink);
}

export default withErrorReporting(handler);
