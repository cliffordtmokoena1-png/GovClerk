import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { WebhookEvent } from "@clerk/nextjs/server";
import { handleUserCreated } from "@/webhook/clerk/handleUserCreated";
import { isWebhookRequestValid } from "@/webhook/clerk/isWebhookRequestValid";
import { handleUserDeleted } from "@/webhook/clerk/handleUserDeleted";
import { handleOrganizationCreated } from "@/webhook/clerk/handleOrganizationCreated";
import { handleOrganizationUpdated } from "@/webhook/clerk/handleOrganizationUpdated";
import { handleOrganizationDeleted } from "@/webhook/clerk/handleOrganizationDeleted";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body: WebhookEvent = req.body;

  console.info("Received webhook event:", body);

  const site = await isWebhookRequestValid(req);
  if (!site) {
    return res.status(400).end();
  }

  switch (body.type) {
    case "user.created": {
      await handleUserCreated(body.data, site);
      break;
    }
    case "user.deleted": {
      await handleUserDeleted(body.data);
      break;
    }
    case "organization.created": {
      await handleOrganizationCreated(body.data);
      break;
    }
    case "organization.updated": {
      await handleOrganizationUpdated(body.data);
      break;
    }
    case "organization.deleted": {
      await handleOrganizationDeleted(body.data);
      break;
    }
  }

  res.status(200).end();
}

export default withErrorReporting(handler);
