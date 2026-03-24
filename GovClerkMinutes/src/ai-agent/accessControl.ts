import { AI_AGENT_ALLOWED_EMAILS, ESCALATION_EMAIL } from "./types";

/**
 * Check if an email address is allowed to access the AI agent on WhatsApp.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (AI_AGENT_ALLOWED_EMAILS as readonly string[]).includes(normalized);
}

/**
 * Get the escalation target email for complex issues.
 */
export function getEscalationEmail(): string {
  return ESCALATION_EMAIL;
}

/**
 * Keywords / patterns that suggest the user wants to speak to a human.
 */
const ESCALATION_KEYWORDS = [
  "speak to a human",
  "talk to a person",
  "real person",
  "human agent",
  "speak to someone",
  "talk to someone",
  "transfer me",
  "escalate",
  "manager",
  "supervisor",
  "complaint",
  "frustrated",
  "unacceptable",
  "refund",
  "cancel my",
  "legal",
  "lawyer",
  "attorney",
];

/**
 * Determine whether a user message should be escalated to a human agent
 * based on keyword analysis.  This is a lightweight pre-LLM check so the
 * agent can fast-path obvious escalation requests.
 */
export function shouldEscalateByKeywords(message: string): boolean {
  const lower = message.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw));
}
