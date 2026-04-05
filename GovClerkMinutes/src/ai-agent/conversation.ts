import { buildSamanthaSystemPrompt, buildGraySystemPrompt } from "./knowledgeBase";
import { shouldEscalateByKeywords, getEscalationEmail } from "./accessControl";
import { initializePaystackPayment } from "./paystack";
import { sendEmail, FROM_SALES } from "@/utils/postmark";
import type { AgentMessage, AgentResponse, AgentIntent, PersonaType, PlanType } from "./types";
import { ADMIN_EMAIL } from "./types";

/** Marker embedded in Samantha's reply to signal a hand-off to Gray. */
const SALES_ESCALATION_MARKER = "[ESCALATE_TO_SALES]";

/** Keywords that indicate Samantha should pass the conversation to Gray. */
const SALES_READY_KEYWORDS = [
  "i want to buy",
  "i'd like to buy",
  "i would like to buy",
  "ready to buy",
  "ready to purchase",
  "i want to purchase",
  "i'd like to purchase",
  "i would like to purchase",
  "let's do it",
  "let's go ahead",
  "sign me up",
  "i want to sign up",
  "i'm ready",
  "i am ready",
  "yes, proceed",
  "yes proceed",
  "please proceed",
  "take my payment",
  "send me a payment link",
  "send payment link",
  "how do i pay",
  "how can i pay",
  "i want to pay",
];

/** Detect whether the user message signals readiness to purchase (used as fast-path). */
export function isSalesReadyByKeywords(message: string): boolean {
  const lower = message.toLowerCase();
  return SALES_READY_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Extract a plan preference from a message, returning null if none detected. */
export function detectPlanChoice(message: string): PlanType | null {
  const lower = message.toLowerCase();
  // Check annual first (more specific), using word boundary \b to avoid false positives
  if (/\bannual(ly)?\b|\byearly\b|\bper year\b/.test(lower)) {
    return "annual";
  }
  if (/\bmonth-to-month\b|\bmonth to month\b|\bmonthly\b|\bper month\b|\bmonth\b/.test(lower)) {
    return "month-to-month";
  }
  // Recognise specific GovClerkMinutes plan tier names — default to month-to-month billing
  // when the user names a plan but doesn't specify a billing cycle.
  if (
    /\bessential\b|\bprofessional\b|\belite\b|\bpremium\b|\bstarter\b|\benterprise\b/.test(lower)
  ) {
    return "month-to-month";
  }
  // Recognise price references (e.g. "R300 plan", "the R450 option").
  // Prices correspond to GovClerkMinutes tiers (R300/R450/R600/R900) and
  // GovClerk Portal tiers (R2500/R8000). Update these if pricing changes.
  if (/\br\s*300\b|\br\s*450\b|\br\s*600\b|\br\s*900\b|\br\s*2[,\s]?500\b|\br\s*8[,\s]?000\b/.test(lower)) {
    return "month-to-month";
  }
  return null;
}

/** Extract an email address from a message, returning null if none found. */
export function extractEmail(message: string): string | null {
  const match = message.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/** Detect the active persona from conversation history by scanning for the sales escalation marker. */
export function detectPersonaFromHistory(history: AgentMessage[]): PersonaType {
  for (const msg of history) {
    if (msg.role === "assistant" && msg.content.includes(SALES_ESCALATION_MARKER)) {
      return "gray";
    }
  }
  return "samantha";
}

/**
 * Call the LLM via OpenRouter to generate a structured AI agent response.
 *
 * Uses the same OpenRouter integration pattern as
 * `platform/sophon/src/llm/callModel.ts` but tailored for conversational
 * chat (no JSON-schema response_format – we want natural text).
 */
async function callChatModel(messages: AgentMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai-agent] OPENROUTER_API_KEY is not set");
    throw new Error("AI agent is not configured");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://govclerkminutes.com",
      "X-Title": "GovClerkMinutes AI Agent",
    },
    body: JSON.stringify({
      model: "openai/gpt-4.1-mini",
      temperature: 0.3,
      messages,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI model returned no content");
  }
  return content.trim();
}

/**
 * Simple intent classifier that runs a lightweight LLM call to categorise the
 * user's message.  Falls back to "general" on failure.
 */
async function classifyIntent(
  userMessage: string
): Promise<{ intent: AgentIntent; confidence: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { intent: "general", confidence: 0 };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://govclerkminutes.com",
        "X-Title": "GovClerkMinutes AI Agent",
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              'Classify the following message into exactly one intent category. Respond with ONLY a JSON object: {"intent":"<category>","confidence":<0-1>}. Categories: product_inquiry, pricing, demo_request, support, sales, payment, escalate, general.',
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: 100,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "intent_classification",
            schema: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "product_inquiry",
                    "pricing",
                    "demo_request",
                    "support",
                    "sales",
                    "payment",
                    "escalate",
                    "general",
                  ],
                },
                confidence: { type: "number" },
              },
              required: ["intent", "confidence"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      }),
    });

    if (!res.ok) {
      return { intent: "general", confidence: 0 };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```(?:json)?\n([\s\S]*?)\n```/i, "$1").trim();
    const parsed = JSON.parse(cleaned) as { intent: AgentIntent; confidence: number };
    return parsed;
  } catch {
    return { intent: "general", confidence: 0 };
  }
}

/** Escape special HTML characters to prevent XSS when interpolating into HTML emails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Handle Gray's (Sales) turn in the conversation.
 * Detects plan choice and email from the message, initialises a PayStack
 * payment link, emails the customer, and notifies the admin for onboarding.
 */
async function processGrayMessage(
  userMessage: string,
  history: AgentMessage[]
): Promise<AgentResponse> {
  const plan = detectPlanChoice(userMessage);
  const emailInMessage = extractEmail(userMessage);

  // Try to find the customer's email from earlier in the conversation (search newest first)
  const emailFromHistory =
    emailInMessage ??
    history.reduceRight<string | null>((found, msg) => found ?? extractEmail(msg.content), null);

  const graySystemPrompt = buildGraySystemPrompt();
  const messages: AgentMessage[] = [
    { role: "system", content: graySystemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const [intentResult, llmReply] = await Promise.all([
    classifyIntent(userMessage),
    callChatModel(messages),
  ]);

  // If we have both a plan and an email, proceed with PayStack + email
  if (plan && emailFromHistory) {
    try {
      const { authorizationUrl, reference } = await initializePaystackPayment(
        emailFromHistory,
        plan
      );
      const planLabel = plan === "annual" ? "Annual Plan" : "Month-to-Month Plan";
      const safeUrl = escapeHtml(authorizationUrl);
      const safeRef = escapeHtml(reference);
      const safeEmail = escapeHtml(emailFromHistory);

      await sendEmail({
        From: FROM_SALES,
        To: emailFromHistory,
        Subject: `Your GovClerkMinutes ${planLabel} Payment Link`,
        HtmlBody: `
          <p>Hi there,</p>
          <p>Great news! Your <strong>${planLabel}</strong> payment link for GovClerkMinutes is ready.</p>
          <p><a href="${authorizationUrl}" style="background:#1a73e8;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Complete Payment</a></p>
          <p>Reference: <code>${safeRef}</code></p>
          <p>If the button above does not work, paste this link into your browser:<br/>${authorizationUrl}</p>
          <p>Once payment is confirmed, you will receive onboarding instructions to get started with GovClerkMinutes.</p>
          <p>Best regards,<br/>Gray<br/>GovClerkMinutes Sales</p>
        `.trim(),
        TextBody: `Hi,\n\nYour ${planLabel} payment link: ${authorizationUrl}\n\nReference: ${reference}\n\nBest regards,\nGray\nGovClerkMinutes Sales`,
        MessageStream: "transactional",
      });

      // Notify admin to prepare onboarding
      await sendEmail({
        From: FROM_SALES,
        To: ADMIN_EMAIL,
        Subject: `[Action Required] New ${planLabel} customer — onboarding needed`,
        HtmlBody: `
          <p>A new customer has initiated payment for the <strong>${planLabel}</strong>.</p>
          <ul>
            <li><strong>Email:</strong> ${safeEmail}</li>
            <li><strong>Plan:</strong> ${planLabel}</li>
            <li><strong>PayStack Reference:</strong> ${safeRef}</li>
          </ul>
          <p>Please send them a manual onboarding email with instructions on how to use GovClerk and the short welcome video once payment is confirmed.</p>
        `.trim(),
        TextBody: `New ${planLabel} customer: ${emailFromHistory}\nPayStack reference: ${reference}\n\nPlease send onboarding email with GovClerk instructions and welcome video.`,
        MessageStream: "transactional",
      });

      const reply = `Perfect! I've sent the ${planLabel} payment link to ${emailFromHistory}. Please check your email and complete the payment. Once confirmed, our team will reach out with onboarding details to get you started with GovClerkMinutes! 🎉`;

      return {
        reply,
        shouldEscalate: false,
        intent: "payment",
        confidence: 1,
        persona: "gray",
      };
    } catch (err) {
      console.error("[ai-agent] Gray PayStack/email error:", err);
      return {
        reply:
          "I'm sorry, I ran into a technical issue while generating your payment link. Please contact our sales team directly at sales@govclerkminutes.com and we'll get this sorted for you right away!",
        shouldEscalate: true,
        intent: "payment",
        confidence: 1,
        persona: "gray",
      };
    }
  } else {
    // Log what's missing so failures are visible in production logs
    if (!plan) {
      console.warn(
        "[ai-agent] Gray: detectPlanChoice() returned null — PayStack skipped.",
        { userMessage }
      );
    }
    if (!emailFromHistory) {
      console.warn(
        "[ai-agent] Gray: no email address found in conversation — PayStack skipped.",
        { userMessage }
      );
    }
  }

  const shouldEscalate = intentResult.intent === "escalate";
  let finalReply = llmReply;

  // Safety net: when the payment system didn't trigger because plan or email is
  // missing, override the LLM reply with a targeted question so Gray cannot
  // falsely claim a payment email was sent.
  if ((!plan || !emailFromHistory) && intentResult.intent === "payment") {
    const needItems: string[] = [];
    if (!plan) {
      needItems.push(
        "which plan you'd like (e.g. Essential, Professional, Elite, or Premium for GovClerkMinutes) and whether you prefer monthly or annual billing"
      );
    }
    if (!emailFromHistory) {
      needItems.push("your email address so I can send you the payment link");
    }
    if (needItems.length === 1) {
      finalReply = `To send your payment link, I still need ${needItems[0]}. Could you please share that?`;
    } else if (needItems.length >= 2) {
      finalReply = `To send your payment link, I still need a couple of things from you:\n• ${needItems[0]}\n• ${needItems[1]}`;
    }
  }

  if (shouldEscalate) {
    const escalationEmail = getEscalationEmail();
    finalReply += `\n\nI'm flagging this conversation for our team. You can reach us at ${escalationEmail}.`;
  }

  return {
    reply: finalReply,
    shouldEscalate,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    persona: "gray",
  };
}

/**
 * Process an incoming user message and generate an AI agent response.
 *
 * @param userMessage    The text sent by the user.
 * @param history        Previous messages in this conversation for context.
 * @param persona        The active persona ("samantha" or "gray"). Auto-detected from history if omitted.
 * @returns An `AgentResponse` with the reply text, escalation flag, intent, confidence, and active persona.
 */
export async function processMessage(
  userMessage: string,
  history: AgentMessage[] = [],
  persona?: PersonaType
): Promise<AgentResponse> {
  // Determine active persona — use provided value or detect from history
  const activePersona: PersonaType = persona ?? detectPersonaFromHistory(history);

  // Delegate to Gray's handler when in the Sales persona
  if (activePersona === "gray") {
    return processGrayMessage(userMessage, history);
  }

  // --- Samantha (Support) ---

  // Fast-path: keyword-based human escalation check
  if (shouldEscalateByKeywords(userMessage)) {
    const escalationEmail = getEscalationEmail();
    return {
      reply: `I understand you'd like to speak with a team member. I'm transferring your conversation to our team now. You can also reach us directly at ${escalationEmail}. Someone will get back to you shortly!`,
      shouldEscalate: true,
      intent: "escalate",
      confidence: 1,
      persona: "samantha",
    };
  }

  // Fast-path: user is ready to purchase — hand off to Gray
  if (isSalesReadyByKeywords(userMessage)) {
    return {
      reply: `Wonderful! Let me hand you over to Gray in our Sales team who will take great care of you. 🤝 ${SALES_ESCALATION_MARKER}`,
      shouldEscalate: false,
      escalatedToSales: true,
      intent: "sales",
      confidence: 1,
      persona: "samantha",
    };
  }

  // Build the full message array for the LLM (Samantha prompt)
  const systemPrompt = buildSamanthaSystemPrompt();
  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  // Run intent classification and chat generation in parallel
  const [intentResult, reply] = await Promise.all([
    classifyIntent(userMessage),
    callChatModel(messages),
  ]);

  // If the LLM itself suggests a sales escalation via its reply marker
  if (reply.includes(SALES_ESCALATION_MARKER)) {
    return {
      reply,
      shouldEscalate: false,
      escalatedToSales: true,
      intent: "sales",
      confidence: intentResult.confidence,
      persona: "samantha",
    };
  }

  // If the LLM suggests escalation to a human agent
  const shouldEscalate = intentResult.intent === "escalate";
  let finalReply = reply;
  if (shouldEscalate) {
    const escalationEmail = getEscalationEmail();
    finalReply += `\n\nI'm also flagging this conversation for our team to follow up with you. You can reach us at ${escalationEmail}.`;
  }

  return {
    reply: finalReply,
    shouldEscalate,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    persona: "samantha",
  };
}
