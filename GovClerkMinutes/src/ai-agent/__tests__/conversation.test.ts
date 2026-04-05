/**
 * Tests for the AI agent conversation handler.
 *
 * We mock the global `fetch` to avoid real LLM API calls and focus on
 * testing the orchestration logic (keyword escalation, message assembly,
 * error handling, persona routing).
 */

import {
  processMessage,
  isSalesReadyByKeywords,
  detectPlanChoice,
  extractEmail,
  detectPersonaFromHistory,
} from "../conversation";

// Keep a reference to the original fetch so we can restore it.
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(
  responses: Array<{ ok: boolean; json: () => Promise<any>; text: () => Promise<string> }>
) {
  let callIndex = 0;
  globalThis.fetch = jest.fn(async () => {
    const res = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return res as any;
  });
}

describe("processMessage", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, OPENROUTER_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns an escalation response for escalation keywords without calling the LLM", async () => {
    // fetch should NOT be called for keyword-based escalation
    globalThis.fetch = jest.fn(async () => {
      throw new Error("fetch should not be called");
    });

    const result = await processMessage("I want to speak to a human");
    expect(result.shouldEscalate).toBe(true);
    expect(result.intent).toBe("escalate");
    expect(result.confidence).toBe(1);
    expect(result.reply).toContain("transferring");
    expect(result.reply).toContain("cliff@govclerkminutes.com");
    expect(result.persona).toBe("samantha");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns a sales escalation response when user is ready to buy (fast-path)", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error("fetch should not be called");
    });

    const result = await processMessage("I want to buy the plan");
    expect(result.shouldEscalate).toBe(false);
    expect(result.escalatedToSales).toBe(true);
    expect(result.intent).toBe("sales");
    expect(result.persona).toBe("samantha");
    expect(result.reply).toContain("Gray");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("calls the LLM and returns a response for normal messages", async () => {
    // Mock: first call = intent classification, second call = chat completion
    mockFetch([
      {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ intent: "product_inquiry", confidence: 0.95 }),
              },
            },
          ],
        }),
        text: async () => "",
      },
      {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "GovClerkMinutes is an AI-powered meeting minutes platform!",
              },
            },
          ],
        }),
        text: async () => "",
      },
    ]);

    const result = await processMessage("Tell me about GovClerkMinutes");
    expect(result.shouldEscalate).toBe(false);
    expect(result.intent).toBe("product_inquiry");
    expect(result.confidence).toBe(0.95);
    expect(result.reply).toContain("GovClerkMinutes");
    expect(result.persona).toBe("samantha");
  });

  it("handles LLM errors gracefully for intent classification", async () => {
    // Intent classification fails, chat succeeds
    mockFetch([
      {
        ok: false,
        json: async () => ({}),
        text: async () => "API error",
      },
      {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Hello! How can I help?" } }],
        }),
        text: async () => "",
      },
    ]);

    const result = await processMessage("Hi there");
    expect(result.intent).toBe("general");
    expect(result.confidence).toBe(0);
    expect(result.reply).toBe("Hello! How can I help?");
  });

  it("throws when the chat model returns an error", async () => {
    // Both calls fail
    mockFetch([
      {
        ok: false,
        json: async () => ({}),
        text: async () => "API error",
      },
      {
        ok: false,
        json: async () => ({}),
        text: async () => "API error",
      },
    ]);

    await expect(processMessage("Hi there")).rejects.toThrow("OpenRouter error");
  });

  it("throws when OPENROUTER_API_KEY is not set", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(processMessage("Hello")).rejects.toThrow("AI agent is not configured");
  });

  it("includes conversation history in the LLM call", async () => {
    let callCount = 0;
    globalThis.fetch = jest.fn(async (_url, options) => {
      callCount++;
      if (callCount <= 2) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    callCount === 1
                      ? JSON.stringify({ intent: "general", confidence: 0.8 })
                      : "Based on our conversation, here is my answer.",
                },
              },
            ],
          }),
          text: async () => "",
        };
      }
      throw new Error("Unexpected call");
    }) as any;

    const history = [
      { role: "user" as const, content: "What is GovClerkMinutes?" },
      { role: "assistant" as const, content: "It's a meeting minutes platform." },
    ];

    const result = await processMessage("Tell me more", history);
    expect(result.reply).toContain("Based on our conversation");

    // Verify the chat call included history
    const chatCall = (globalThis.fetch as jest.Mock).mock.calls[1];
    if (chatCall) {
      const body = JSON.parse(chatCall[1].body);
      // Messages should be: system + 2 history + 1 new user message = 4
      expect(body.messages.length).toBe(4);
    }
  });

  it("routes to Gray persona when history contains the sales escalation marker", async () => {
    mockFetch([
      {
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: JSON.stringify({ intent: "payment", confidence: 0.9 }) } },
          ],
        }),
        text: async () => "",
      },
      {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Sure! Which plan: Annual or Month-to-Month?" } }],
        }),
        text: async () => "",
      },
    ]);

    const history = [
      { role: "user" as const, content: "I'm ready to buy" },
      {
        role: "assistant" as const,
        content:
          "Wonderful! Let me hand you over to Gray in our Sales team. 🤝 [ESCALATE_TO_SALES]",
      },
    ];

    const result = await processMessage("I'd like the annual plan", history);
    expect(result.persona).toBe("gray");
  });
});

describe("isSalesReadyByKeywords", () => {
  it("returns true for purchase-ready messages", () => {
    expect(isSalesReadyByKeywords("I want to buy")).toBe(true);
    expect(isSalesReadyByKeywords("I'm ready to purchase")).toBe(true);
    expect(isSalesReadyByKeywords("sign me up")).toBe(true);
    expect(isSalesReadyByKeywords("send me a payment link")).toBe(true);
    expect(isSalesReadyByKeywords("let's do it")).toBe(true);
  });

  it("returns false for non-purchase messages", () => {
    expect(isSalesReadyByKeywords("Tell me about pricing")).toBe(false);
    expect(isSalesReadyByKeywords("What features do you have?")).toBe(false);
    expect(isSalesReadyByKeywords("Hello!")).toBe(false);
  });
});

describe("detectPlanChoice", () => {
  it("returns 'annual' for annual plan mentions", () => {
    expect(detectPlanChoice("I'd like the annual plan")).toBe("annual");
    expect(detectPlanChoice("annual")).toBe("annual");
    expect(detectPlanChoice("per year please")).toBe("annual");
  });

  it("returns 'month-to-month' for monthly plan mentions", () => {
    expect(detectPlanChoice("monthly plan please")).toBe("month-to-month");
    expect(detectPlanChoice("month-to-month")).toBe("month-to-month");
    expect(detectPlanChoice("per month")).toBe("month-to-month");
  });

  it("returns 'month-to-month' for named GovClerkMinutes plan tier names", () => {
    expect(detectPlanChoice("I want the Essential plan")).toBe("month-to-month");
    expect(detectPlanChoice("Professional plan please")).toBe("month-to-month");
    expect(detectPlanChoice("Elite")).toBe("month-to-month");
    expect(detectPlanChoice("Premium sounds great")).toBe("month-to-month");
  });

  it("returns 'month-to-month' for GovClerk Portal plan tier names", () => {
    expect(detectPlanChoice("I'd like the Starter plan")).toBe("month-to-month");
    expect(detectPlanChoice("Enterprise option")).toBe("month-to-month");
  });

  it("returns 'month-to-month' for price references", () => {
    expect(detectPlanChoice("the R300 plan")).toBe("month-to-month");
    expect(detectPlanChoice("R450 option")).toBe("month-to-month");
    expect(detectPlanChoice("I'll go with R600")).toBe("month-to-month");
    expect(detectPlanChoice("R900 plan please")).toBe("month-to-month");
  });

  it("annual takes precedence over named tier in the same message", () => {
    expect(detectPlanChoice("I want the Essential plan billed annually")).toBe("annual");
  });

  it("returns null when no plan is mentioned", () => {
    expect(detectPlanChoice("Hello there")).toBeNull();
    expect(detectPlanChoice("What are my options?")).toBeNull();
  });
});

describe("extractEmail", () => {
  it("extracts an email from a message", () => {
    expect(extractEmail("My email is test@example.com please")).toBe("test@example.com");
    expect(extractEmail("Send to foo.bar+tag@domain.co.za")).toBe("foo.bar+tag@domain.co.za");
  });

  it("returns null when no email is present", () => {
    expect(extractEmail("Hello, how are you?")).toBeNull();
    expect(extractEmail("Call me on 0123456789")).toBeNull();
  });
});

describe("detectPersonaFromHistory", () => {
  it("returns 'samantha' for empty history", () => {
    expect(detectPersonaFromHistory([])).toBe("samantha");
  });

  it("returns 'samantha' when no escalation marker is present", () => {
    const history = [
      { role: "user" as const, content: "Hi there" },
      { role: "assistant" as const, content: "Hello! How can I help?" },
    ];
    expect(detectPersonaFromHistory(history)).toBe("samantha");
  });

  it("returns 'gray' when escalation marker is present in assistant message", () => {
    const history = [
      { role: "user" as const, content: "I want to buy" },
      {
        role: "assistant" as const,
        content: "Let me hand you over to Gray. [ESCALATE_TO_SALES]",
      },
    ];
    expect(detectPersonaFromHistory(history)).toBe("gray");
  });
});
