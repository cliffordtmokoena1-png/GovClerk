import React from "react";
// Jest provides describe/it/expect globals via setup
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import ConversationCard from "../ConversationCard";
import type { Conversation } from "../../../../admin/whatsapp/types";

const baseConversation: Conversation = {
  conversationId: "c1",
  whatsappId: "123",
  businessWhatsappId: "16463311785",
  leadName: "Test User",
  email: "test@example.com",
  source: "wati",
  startedAt: new Date().toISOString(),
  messages: [],
  scheduleRequests: [],
};

describe("ConversationCard layout", () => {
  it("renders a scrollable messages area and a separate composer at bottom", () => {
    // Mock scrollIntoView to verify auto-scroll behavior
    const scrollIntoViewMock = jest.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    // Create many messages to force overflow
    const manyMessages = Array.from({ length: 200 }).map((_, index) => ({
      id: `m-${index}`,
      direction: index % 2 === 0 ? "in" : "out",
      text: `Message number ${index}`,
      timestamp: new Date().toISOString(),
    }));

    const convoWithMessages: Conversation = {
      ...baseConversation,
      messages: manyMessages as any,
    };

    render(
      <ChakraProvider>
        <ConversationCard
          conversation={convoWithMessages}
          whatsappMessageTemplates={[]}
          isSelected
          onToggleSelected={() => {}}
          revalidateWhatsapps={() => {}}
          autoScrollToBottom
          onStartCall={() => {}}
        />
      </ChakraProvider>
    );

    const scrollArea = screen.getByTestId("messages-scroll-area");
    const composer = screen.getByTestId("composer");

    // The messages area exists and is separate from the composer
    expect(scrollArea).toBeInTheDocument();

    // The composer should exist and not be inside the scroll area
    expect(composer).toBeInTheDocument();
    expect(scrollArea.contains(composer)).toBe(false);

    // The composer should remain outside the scroll container
    expect(scrollArea.contains(composer)).toBe(false);

    // Ensure the composer renders after the scroll area in DOM order
    const position = scrollArea.compareDocumentPosition(composer);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Auto-scroll should have been triggered at least once
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
