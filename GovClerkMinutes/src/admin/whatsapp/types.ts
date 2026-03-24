export interface ScheduleRequest {
  createdAt: string;
  templateId: string;
  variables: Record<string, any> | null;
  sendAt: string;
  isSent: number;
  senderUserId: string;
  cancelOnReply: number;
}

export type SchedulerMode = "template" | "freeform";

export type ScheduleWhatsappPayloadBase = {
  sendAt: string; // ISO timestamp string
  whatsappId: string; // digits only, no +
  businessWhatsappId: string; // digits only, no +
  makeHubspotTask: boolean;
  cancelOnReply: boolean;
  mode: SchedulerMode;
  source: Source;
};

export type ScheduleWhatsappTemplatePayload = ScheduleWhatsappPayloadBase & {
  mode: "template";
  templateName: string;
  templateBody: string;
  // JSON string of key/value variables
  templateVariables: string;
  language: string;
};

export type ScheduleWhatsappFreeformPayload = ScheduleWhatsappPayloadBase & {
  mode: "freeform";
  text: string;
};

export type ScheduleWhatsappRequestPayload =
  | ScheduleWhatsappTemplatePayload
  | ScheduleWhatsappFreeformPayload;

export type Source = "wati" | "whatsapp";
export type MessageType =
  | "text"
  | "template"
  | "audio"
  | "call_permission_request"
  | "interactive_call_permission_reply";

export interface Message {
  timestamp: string;
  sender: string;
  text: string;
  type: MessageType;
  direction: "inbound" | "outbound";
  messageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  error?: string;
}

export interface Conversation {
  conversationId: string;
  whatsappId: string;
  businessWhatsappId: string;
  leadName: string;
  email?: string;
  userId?: string;
  frequency?: string;
  dueDate?: string;
  startedAt: string;
  lastReadAt?: string;
  source: Source;
  messages: Message[];
  scheduleRequests: ScheduleRequest[];
}

export type SortOption = "recent-desc" | "recent-asc" | "start-desc" | "start-asc";

export interface ScheduledMessage {
  is_sent: boolean;
  whatsapp_id: string;
  template_id: string;
  send_at: string;
  sender_user_id: string;
}

export interface ContactProperties {
  [key: string]: string | undefined;
  name?: string;
  email?: string;
  phone?: string;
}

export namespace WhatsappWebhook {
  /** Metadata for the business phone number */
  export interface Metadata {
    display_phone_number: string;
    phone_number_id: string;
  }

  export interface ContactProfile {
    name?: string;
  }

  export interface Contact {
    profile?: ContactProfile;
    wa_id: string; // WhatsApp ID (phone number as digits)
  }

  // Message Types (add more variants as needed: image, document, etc.)
  export interface TextMessage {
    from: string; // sender wa_id
    id: string; // message id
    timestamp: string; // unix timestamp string
    type: "text";
    text: {
      body: string;
    };
  }

  export interface AudioMessage {
    from: string; // sender wa_id
    id: string; // message id
    timestamp: string; // unix timestamp string
    type: "audio";
    audio: {
      mime_type?: string; // e.g. "audio/ogg; codecs=opus"
      sha256?: string;
      id: string; // media id for retrieval
      voice?: boolean; // true if voice note
    };
  }

  export interface InteractiveMessage {
    from: string;
    id: string;
    timestamp: string; // unix timestamp string
    type: "interactive";
    context: {
      from: string;
      id: string; // message id of request or call id
    };
    interactive: {
      type: "call_permission_reply";
      call_permission_reply: {
        response: "accept" | "reject";
        is_permanent?: boolean;
        expiration_timestamp?: number; // seconds epoch from docs
        response_source?: "user_action" | "automatic";
      };
    };
  }

  export type Message = TextMessage | AudioMessage | InteractiveMessage; // | ImageMessage | DocumentMessage ...

  // Sometimes messages changes are not messages but updates to statuses of previously sent messages.
  export type StatusValue = "sent" | "delivered" | "read" | "failed";

  export interface StatusErrorData {
    details?: string;
  }

  export interface StatusErrorItem {
    code: number;
    title: string; // same as message
    message: string; // same as title
    error_data?: StatusErrorData;
    href?: string; // docs url
  }

  export interface StatusPricing {
    billable?: boolean;
    pricing_model?: string; // e.g. CBP, PMP
    type?: string; // e.g. regular, free_customer_service, free_entry_point
    category?: string; // marketing, service, utility, etc.
  }

  export interface StatusItem {
    id: string; // WhatsApp message id
    status: StatusValue;
    timestamp: string; // unix timestamp string
    recipient_id: string; // WhatsApp id
    errors?: StatusErrorItem[];
  }

  /** The value object in a messages change */
  export interface MessagesValue {
    messaging_product: "whatsapp";
    metadata: Metadata;
    contacts?: Contact[];
    messages?: Message[];
    statuses?: StatusItem[];
  }

  /** Change for field "messages" */
  export interface MessagesChange {
    field: "messages";
    value: MessagesValue;
  }

  // --- Calling API Types ---
  export type CallEvent = "connect" | "terminate";
  export type CallDirection = "BUSINESS_INITIATED" | "USER_INITIATED";
  export type CallStatusValue = "RINGING" | "ACCEPTED" | "REJECTED";

  export interface CallSession {
    sdp_type: "offer" | "answer";
    sdp: string; // RFC 8866 SDP
  }

  export interface CallErrorItem {
    code: number;
    message: string;
    href?: string;
    error_data?: { details?: string };
  }

  export interface CallItem {
    id: string; // WhatsApp call ID (wacid.*)
    to: string; // callee (phone number digits)
    from: string; // caller (phone number digits)
    event: CallEvent;
    timestamp: string; // unix timestamp string
    direction?: CallDirection;
    deeplink_payload?: string;
    cta_payload?: string;
    biz_opaque_callback_data?: string;
    session?: CallSession; // present on connect with SDP offer/answer
    status?: Array<"Failed" | "Completed">; // terminate only
    start_time?: string; // unix ts string
    end_time?: string; // unix ts string
    duration?: number; // seconds
  }

  // Status item for calls statuses array on field "calls"
  export interface CallStatusItem {
    id: string; // WhatsApp call ID
    type: "call";
    status: CallStatusValue;
    timestamp: string; // unix timestamp string
    recipient_id: string; // callee number
    biz_opaque_callback_data?: string; // optional tracking id
  }

  export interface CallsValue {
    messaging_product: "whatsapp";
    metadata: Metadata;
    contacts?: Contact[];
    calls: CallItem[];
    errors?: CallErrorItem[];
    statuses?: CallStatusItem[];
  }

  export interface CallsChange {
    field: "calls";
    value: CallsValue;
  }

  // Union of all change types (expand as implementing more fields)
  export type Change = MessagesChange | CallsChange; // | TemplateChange ...

  export interface Entry {
    id: string;
    changes: Change[];
  }

  export interface Payload {
    object: "whatsapp_business_account" | string; // Usually whatsapp_business_account
    entry: Entry[];
  }
}
