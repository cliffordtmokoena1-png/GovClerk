import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).end();
}

export default withErrorReporting(handler);
