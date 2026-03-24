import { assertString } from "@/utils/assert";

export type ListEmailParams = {
  lead: string;
  campaignId: string;
  sortOrder?: "asc" | "desc";
};

export type ListEmailResponse = {
  items: Email[];
};

type Email = {
  id: string;
  eaccount: string;
};

export async function listEmail({
  lead,
  campaignId,
  sortOrder,
}: ListEmailParams): Promise<ListEmailResponse> {
  const queryString = new URLSearchParams({
    lead,
    campiaign_id: campaignId,
    sort_order: sortOrder ?? "desc",
  }).toString();

  // https://developer.instantly.ai/api/v2/email/listemail
  const data = await fetch("https://api.instantly.ai/api/v2/emails?" + queryString, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${assertString(process.env.INSTANTLY_V2_KEY)}`,
    },
  }).then((r) => r.json());

  return data;
}

export type ReplyToEmailParams = {
  emailId: string;
  emailAccount: string;
  subject: string;
  body: {
    text: string;
    html: string;
  };
  cc?: string[];
  bcc?: string[];
};

export async function replyToEmail({
  emailId,
  emailAccount,
  subject,
  body,
  cc,
  bcc,
}: ReplyToEmailParams): Promise<void> {
  const res = await fetch("https://api.instantly.ai/api/v2/emails/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTANTLY_V2_KEY}`,
    },
    body: JSON.stringify({
      reply_to_uuid: emailId,
      eaccount: emailAccount,
      subject,
      body: {
        text: body.text,
        html: body.html,
      },
      ...(cc && { cc_address_email_list: cc.join(",") }),
      ...(bcc && { bcc_address_email_list: bcc.join(",") }),
    }),
  }).then((r) => r.json());

  // eslint-disable-next-line no-console
  console.log("reply_to_email response", res);
}
