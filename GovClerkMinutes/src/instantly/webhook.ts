export namespace InstantlyWebhook {
  export type Body = KnownBody | UnknownBody;

  export type KnownBody = EmailSent | ReplyReceived | LeadInterested;

  export interface UnknownBody extends Base<string> {
    [key: string]: unknown;
  }

  interface Base<T extends string> {
    event_type: T;
    timestamp: string;
    workspace: string;
    campaign_id: string;
    campaign_name: string;
  }

  interface EmailSent extends Base<"email_sent"> {
    email_account: string;
    is_first: boolean;
    lead_email: string;
    email: string;
    step: number;
    variant: number;
    email_subject: string;
    email_html: string;
  }

  interface ReplyReceived extends Base<"reply_received"> {
    email_account: string;
    is_first: boolean;
    lead_email: string;
    email: string;
    step: number;
    variant: number;
    reply_subject: string;
    reply_text: string;
    reply_html: string;
    unibox_url: string;
  }

  interface LeadInterested extends Base<"lead_interested"> {
    reply_text_snippet: string;
    lead_email: string;
    email: string;
    step: number;
    variant: number;
    reply_subject: string;
    reply_text: string;
    reply_html: string;
  }
}

export function isKnownBody(b: InstantlyWebhook.Body): b is InstantlyWebhook.KnownBody {
  return (
    b.event_type === "email_sent" ||
    b.event_type === "reply_received" ||
    b.event_type === "lead_interested"
  );
}

export function getEmail(b: InstantlyWebhook.Body): string | undefined {
  if (typeof b.lead_email === "string") {
    return b.lead_email;
  }
  if (typeof b.email === "string") {
    return b.email;
  }
  return undefined;
}
