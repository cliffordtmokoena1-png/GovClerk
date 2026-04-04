export namespace BrevoWebhook {
  export type Body = KnownBody | UnknownBody;

  export type KnownBody =
    | Request
    | Delivered
    | Opened
    | Clicked
    | HardBounce
    | SoftBounce
    | Unsubscribed
    | Complaint
    | Reply;

  export interface UnknownBody extends Base<string> {
    [key: string]: unknown;
  }

  interface Base<T extends string> {
    event: T;
    email: string;
    id: number;
    date: string;
    ts: number;
    "message-id": string;
    tag: string;
    sending_ip?: string;
    ts_event: number;
    subject?: string;
  }

  export interface Request extends Base<"request"> {}

  export interface Delivered extends Base<"delivered"> {
    reason?: string;
  }

  export interface Opened extends Base<"opened"> {
    ts_epoch: number;
    ip?: string;
    user_agent?: string;
    link?: string;
  }

  export interface Clicked extends Base<"clicked"> {
    ts_epoch: number;
    ip?: string;
    user_agent?: string;
    link: string;
  }

  export interface HardBounce extends Base<"hard_bounce"> {
    reason?: string;
  }

  export interface SoftBounce extends Base<"soft_bounce"> {
    reason?: string;
  }

  export interface Unsubscribed extends Base<"unsubscribed"> {}

  export interface Complaint extends Base<"complaint"> {}

  export interface Reply extends Base<"reply"> {
    reply_text?: string;
    reply_html?: string;
    reply_subject?: string;
  }
}

export function isKnownBody(b: BrevoWebhook.Body): b is BrevoWebhook.KnownBody {
  return (
    b.event === "request" ||
    b.event === "delivered" ||
    b.event === "opened" ||
    b.event === "clicked" ||
    b.event === "hard_bounce" ||
    b.event === "soft_bounce" ||
    b.event === "unsubscribed" ||
    b.event === "complaint" ||
    b.event === "reply"
  );
}

export function getEmail(b: BrevoWebhook.Body): string | undefined {
  if (typeof b.email === "string") {
    return b.email;
  }
  return undefined;
}
