/** Roles allowed to interact with the AI agent via WhatsApp. */
export const AI_AGENT_ALLOWED_EMAILS = [
  "cliff@govclerkminutes.com",
  "sales@govclerkminutes.com",
  "support@govclerkminutes.com",
] as const;

/** Escalation target for complex issues. */
export const ESCALATION_EMAIL = "cliff@govclerkminutes.com";

/** Admin email to notify for manual onboarding after payment. */
export const ADMIN_EMAIL = "cliff@govclerkminutes.com";

/** Channels the AI agent can operate on. */
export type AgentChannel = "whatsapp" | "facebook";

/** Active persona handling the conversation. */
export type PersonaType = "samantha" | "gray";

/** Available subscription plan options. */
export type PlanType = "annual" | "month-to-month";

/** PayStack plan codes for each subscription type. */
export const PAYSTACK_PLAN_CODES: Record<PlanType, string> = {
  annual: process.env.PAYSTACK_PLAN_ANNUAL ?? "PLN_annual_govclerk",
  "month-to-month": process.env.PAYSTACK_PLAN_MONTHLY ?? "PLN_monthly_govclerk",
};

/** A single turn in a conversation with the AI agent. */
export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Classification of how the agent should handle a message. */
export type AgentIntent =
  | "product_inquiry"
  | "pricing"
  | "demo_request"
  | "support"
  | "sales"
  | "payment"
  | "escalate"
  | "cross_sell_minutes"
  | "general";

/** Result returned by the AI agent after processing a message. */
export interface AgentResponse {
  /** The reply text to send back to the user. */
  reply: string;
  /** Whether this message should be escalated to a human agent. */
  shouldEscalate: boolean;
  /** Detected intent of the user message. */
  intent: AgentIntent;
  /** Optional: confidence score (0-1). */
  confidence: number;
  /** The persona that generated this response. */
  persona: PersonaType;
  /** Whether the conversation just transitioned to Gray (Sales). */
  escalatedToSales?: boolean;
}

/** Payload sent to the AI agent chat API endpoint. */
export interface AgentChatRequest {
  /** The incoming user message text. */
  message: string;
  /** WhatsApp ID of the sender (phone number). */
  senderWhatsappId: string;
  /** Business WhatsApp ID that received the message. */
  businessWhatsappId: string;
  /** Channel the message originated from. */
  channel: AgentChannel;
  /** Previous messages for context (optional). */
  conversationHistory?: AgentMessage[];
  /** Active persona at the time of the request (optional, defaults to "samantha"). */
  persona?: PersonaType;
}

/** Shape of a daily report entry. */
export interface DailyReportEntry {
  metric: string;
  value: number | string;
}

/** Full daily report response. */
export interface DailyReport {
  date: string;
  sales: DailyReportEntry[];
  followUps: DailyReportEntry[];
  scheduledDemos: DailyReportEntry[];
  totalConversations: number;
  aiHandledCount: number;
  escalatedCount: number;
}

/** Aggregated metrics for the AI Activities admin dashboard. */
export interface AiActivitiesMetrics {
  /** Total inbound WhatsApp conversations (calls received). */
  callsReceived: number;
  /** Total outbound AI-initiated conversations (calls made). */
  callsMade: number;
  /** Total messages processed by the AI agent. */
  messagesProcessed: number;
  /** Number of payment plans sent out to users by the AI. */
  paymentPlansSent: number;
  /** Number of successful paid conversions (payments completed). */
  paidPlans: number;
  /** Number of unique contacts flagged for follow-up. */
  followUpCount: number;
  /** ISO date string for the reporting period (today). */
  date: string;
}
