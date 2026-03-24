import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // This is a placeholder for your own business logic later
  return res.status(200).json({ message: "Webhook is active" });
}