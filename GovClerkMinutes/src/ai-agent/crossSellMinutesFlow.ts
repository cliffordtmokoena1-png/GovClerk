/**
 * Cross-sell conversation flow for Samantha AI agent.
 *
 * This module implements a state machine that guides an org through learning
 * about GovClerkMinutes when they are running low on GovClerk Portal streaming hours.
 */

export type CrossSellState =
  | "entry"
  | "yes_describe"
  | "hours_query"
  | "plan_recommend"
  | "email_confirm"
  | "send_link"
  | "no_portal"
  | "re_engage"
  | "done";

export interface CrossSellSession {
  state: CrossSellState;
  orgName: string;
  orgEmail?: string;
  hoursNeeded?: number;
  recommendedPlan?: string;
  lastMessageAt: number; // unix ms
}

/**
 * GovClerkMinutes plan descriptions for Samantha to use.
 */
const MINUTES_PLANS = [
  { name: "Essential", tokens: 300, price_zar: 499, hours_approx: 5 },
  { name: "Professional", tokens: 600, price_zar: 899, hours_approx: 10 },
  { name: "Elite", tokens: 1200, price_zar: 1499, hours_approx: 20 },
  { name: "Premium", tokens: 2400, price_zar: 2499, hours_approx: 40 },
] as const;

type MinutesPlan = (typeof MINUTES_PLANS)[number];

/**
 * Determines the recommended GovClerkMinutes plan based on hours needed.
 */
export function recommendMinutesPlan(hoursNeeded: number): MinutesPlan {
  return (
    MINUTES_PLANS.find((p) => p.hours_approx >= hoursNeeded) ??
    MINUTES_PLANS[MINUTES_PLANS.length - 1]
  );
}

/**
 * Returns Samantha's reply and next state for each cross-sell step.
 */
export function processCrossSellMessage(
  session: CrossSellSession,
  userMessage: string
): { reply: string; nextState: CrossSellState; updatedSession: Partial<CrossSellSession> } {
  const msg = userMessage.toLowerCase().trim();

  switch (session.state) {
    case "entry": {
      const isYes = /\b(yes|yeah|yep|sure|correct|yup|absolutely|please)\b/.test(msg);
      const isNo = /\b(no|nope|nah|not really|negative)\b/.test(msg);
      if (isYes) {
        return {
          reply: "Great! 😊 GovClerkMinutes is our AI-powered meeting minutes platform. Instead of live streaming, you simply *upload a recording* (audio or video) of your meeting, and our AI transcribes it and generates professional meeting minutes automatically — fully formatted and ready to publish.\n\nTo recommend the right plan for you: *how many hours of recordings* do you typically need to process per month?",
          nextState: "hours_query",
          updatedSession: {},
        };
      }
      if (isNo) {
        return {
          reply: "No problem at all! 😊 Would you like to *top up your GovClerk portal streaming hours* instead so you can continue with your live meetings?",
          nextState: "no_portal",
          updatedSession: {},
        };
      }
      return {
        reply: "Just to confirm — are you interested in learning about GovClerkMinutes, our platform for generating meeting minutes from uploaded recordings? Reply *Yes* or *No*. 😊",
        nextState: "entry",
        updatedSession: {},
      };
    }

    case "hours_query": {
      const hoursMatch = msg.match(/(\d+(\.\d+)?)\s*(hour|hr|h)/);
      const numberMatch = msg.match(/\b(\d+)\b/);
      const hoursNeeded = hoursMatch
        ? parseFloat(hoursMatch[1])
        : numberMatch
        ? parseInt(numberMatch[1], 10)
        : null;

      if (!hoursNeeded || hoursNeeded <= 0) {
        return {
          reply: "How many hours of meeting recordings do you need to process each month? (e.g. \"5 hours\" or \"10 hours\")",
          nextState: "hours_query",
          updatedSession: {},
        };
      }

      const plan = recommendMinutesPlan(hoursNeeded);
      return {
        reply: `Based on ${hoursNeeded} hours of recordings per month, I'd recommend our *${plan.name} Plan*:\n\n✅ ~${plan.hours_approx} hours of recordings/month\n✅ ${plan.tokens} processing tokens\n💰 R${plan.price_zar}/month\n\nThis would cover your needs perfectly! Shall I send you a payment link for the *${plan.name} Plan*? To confirm your identity, please share the *email address registered on your GovClerk portal*.`,
        nextState: "email_confirm",
        updatedSession: { hoursNeeded, recommendedPlan: plan.name },
      };
    }

    case "email_confirm": {
      const emailMatch = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (!emailMatch) {
        return {
          reply: "Please share the email address registered on your GovClerk portal so I can confirm your account and send you the payment link. 😊",
          nextState: "email_confirm",
          updatedSession: {},
        };
      }
      return {
        reply: `Perfect! I've confirmed your account. 🎉 I'm sending a *${session.recommendedPlan} Plan* payment link to *${emailMatch[0]}* right now. Check your inbox in the next few minutes — the link will take you directly to our secure payment page.\n\nWelcome to GovClerkMinutes, ${session.orgName}! 🚀`,
        nextState: "send_link",
        updatedSession: { orgEmail: emailMatch[0] },
      };
    }

    case "no_portal": {
      const isYes = /\b(yes|yeah|yep|sure|correct|yup|absolutely|please)\b/.test(msg);
      if (isYes) {
        return {
          reply: "Great! Please visit your GovClerk dashboard to top up your streaming hours, or reply here and I'll send you the direct link. 😊",
          nextState: "done",
          updatedSession: {},
        };
      }
      return {
        reply: "No problem! Feel free to reach out anytime if you need help with your portal or want to learn more about GovClerkMinutes. Have a great day! 👋",
        nextState: "done",
        updatedSession: {},
      };
    }

    case "re_engage": {
      return {
        reply: `Hey ${session.orgName} 👋 Still there? I know things get busy, but I'd hate for your meetings to be disrupted by running out of hours. Even just a quick top-up or trying GovClerkMinutes could save the day! Can I help you sort this out? 😊`,
        nextState: "entry",
        updatedSession: { lastMessageAt: Date.now() },
      };
    }

    default:
      return {
        reply: "Is there anything else I can help you with? 😊",
        nextState: "done",
        updatedSession: {},
      };
  }
}
