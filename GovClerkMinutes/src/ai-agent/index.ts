export {
  processMessage,
  isSalesReadyByKeywords,
  detectPlanChoice,
  extractEmail,
  detectPersonaFromHistory,
} from "./conversation";
export { isAllowedEmail, shouldEscalateByKeywords, getEscalationEmail } from "./accessControl";
export {
  buildSystemPrompt,
  buildSamanthaSystemPrompt,
  buildGraySystemPrompt,
  PRODUCT_KNOWLEDGE_BASE,
} from "./knowledgeBase";
export { initializePaystackPayment } from "./paystack";
export type {
  AgentChannel,
  AgentMessage,
  AgentIntent,
  AgentResponse,
  AgentChatRequest,
  AiActivitiesMetrics,
  DailyReport,
  DailyReportEntry,
  PersonaType,
  PlanType,
} from "./types";
export {
  AI_AGENT_ALLOWED_EMAILS,
  ESCALATION_EMAIL,
  ADMIN_EMAIL,
  PAYSTACK_PLAN_CODES,
} from "./types";
