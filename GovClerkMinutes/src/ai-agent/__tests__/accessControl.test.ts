import { isAllowedEmail, shouldEscalateByKeywords, getEscalationEmail } from "../accessControl";

describe("AI Agent Access Control", () => {
  describe("isAllowedEmail", () => {
    it("returns true for allowed emails", () => {
      expect(isAllowedEmail("cliff@govclerkminutes.com")).toBe(true);
      expect(isAllowedEmail("sales@govclerkminutes.com")).toBe(true);
      expect(isAllowedEmail("support@govclerkminutes.com")).toBe(true);
    });

    it("returns true for emails with different casing", () => {
      expect(isAllowedEmail("Cliff@GovClerkMinutes.com")).toBe(true);
      expect(isAllowedEmail("SALES@GOVCLERKMINUTES.COM")).toBe(true);
    });

    it("returns true for emails with leading/trailing whitespace", () => {
      expect(isAllowedEmail("  cliff@govclerkminutes.com  ")).toBe(true);
    });

    it("returns false for non-allowed emails", () => {
      expect(isAllowedEmail("random@example.com")).toBe(false);
      expect(isAllowedEmail("admin@other.com")).toBe(false);
    });

    it("returns false for null/undefined/empty", () => {
      expect(isAllowedEmail(null)).toBe(false);
      expect(isAllowedEmail(undefined)).toBe(false);
      expect(isAllowedEmail("")).toBe(false);
    });
  });

  describe("shouldEscalateByKeywords", () => {
    it("returns true when message contains escalation keywords", () => {
      expect(shouldEscalateByKeywords("I want to speak to a human")).toBe(true);
      expect(shouldEscalateByKeywords("Can I talk to a person?")).toBe(true);
      expect(shouldEscalateByKeywords("I need a real person")).toBe(true);
      expect(shouldEscalateByKeywords("Please transfer me")).toBe(true);
      expect(shouldEscalateByKeywords("I want to escalate this")).toBe(true);
      expect(shouldEscalateByKeywords("Get me your manager")).toBe(true);
      expect(shouldEscalateByKeywords("I need a refund")).toBe(true);
      expect(shouldEscalateByKeywords("I want to cancel my subscription")).toBe(true);
    });

    it("returns false for normal messages", () => {
      expect(shouldEscalateByKeywords("How much does it cost?")).toBe(false);
      expect(shouldEscalateByKeywords("Can you tell me about the product?")).toBe(false);
      expect(shouldEscalateByKeywords("I'd like a demo")).toBe(false);
      expect(shouldEscalateByKeywords("Hello!")).toBe(false);
    });

    it("is case insensitive", () => {
      expect(shouldEscalateByKeywords("SPEAK TO A HUMAN")).toBe(true);
      expect(shouldEscalateByKeywords("Talk To A Person")).toBe(true);
    });
  });

  describe("getEscalationEmail", () => {
    it("returns the correct escalation email", () => {
      expect(getEscalationEmail()).toBe("cliff@govclerkminutes.com");
    });
  });
});
