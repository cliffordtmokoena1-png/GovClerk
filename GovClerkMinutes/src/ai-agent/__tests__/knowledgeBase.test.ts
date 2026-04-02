import {
  buildSystemPrompt,
  buildSamanthaSystemPrompt,
  buildGraySystemPrompt,
  PRODUCT_KNOWLEDGE_BASE,
} from "../knowledgeBase";

describe("AI Agent Knowledge Base", () => {
  describe("PRODUCT_KNOWLEDGE_BASE", () => {
    it("contains information about GovClerkMinutes", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("GovClerkMinutes");
    });

    it("includes core features", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("AI Transcription");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Automated Minutes Generation");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Speaker Diarization");
    });

    it("includes contact information", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("support@govclerkminutes.com");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("sales@govclerkminutes.com");
    });

    it("includes the new WhatsApp number", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("27664259236");
    });

    it("includes how-it-works steps", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Upload");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Transcribe");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Generate");
    });

    it("includes use cases", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("City council meetings");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Board of directors meetings");
    });

    it("includes pricing plan types", () => {
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Month-to-Month");
      expect(PRODUCT_KNOWLEDGE_BASE).toContain("Annual");
    });
  });

  describe("buildSystemPrompt", () => {
    it("returns a non-empty string", () => {
      const prompt = buildSystemPrompt();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("includes the product knowledge base", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("GovClerkMinutes");
      expect(prompt).toContain("AI Transcription");
    });

    it("includes behavioral guidelines", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("Behavioral Guidelines");
      expect(prompt).toContain("Professional");
      expect(prompt).toContain("Escalation");
    });

    it("includes Samantha's identity", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("Samantha");
    });
  });

  describe("buildSamanthaSystemPrompt", () => {
    it("identifies as Samantha", () => {
      const prompt = buildSamanthaSystemPrompt();
      expect(prompt).toContain("Samantha");
    });

    it("includes escalation-to-sales instruction", () => {
      const prompt = buildSamanthaSystemPrompt();
      expect(prompt).toContain("Gray");
      expect(prompt).toContain("ESCALATE_TO_SALES");
    });

    it("includes the product knowledge base", () => {
      const prompt = buildSamanthaSystemPrompt();
      expect(prompt).toContain("GovClerkMinutes");
    });
  });

  describe("buildGraySystemPrompt", () => {
    it("identifies as Gray", () => {
      const prompt = buildGraySystemPrompt();
      expect(prompt).toContain("Gray");
    });

    it("references the plan options", () => {
      const prompt = buildGraySystemPrompt();
      expect(prompt).toContain("Annual");
      expect(prompt).toContain("Month-to-Month");
    });

    it("mentions PayStack payment flow", () => {
      const prompt = buildGraySystemPrompt();
      expect(prompt).toContain("payment link");
    });

    it("includes the product knowledge base", () => {
      const prompt = buildGraySystemPrompt();
      expect(prompt).toContain("GovClerkMinutes");
    });
  });
});
