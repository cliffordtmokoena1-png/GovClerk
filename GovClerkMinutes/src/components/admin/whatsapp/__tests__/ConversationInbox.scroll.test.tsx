import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConversationInbox from "@/components/admin/whatsapp/ConversationInbox";
import type { Conversation } from "@/admin/whatsapp/types";

// Mock non-essential child components to keep the test focused and lightweight
jest.mock("@/components/admin/whatsapp/FilterBar", () => () => null);
jest.mock("@/components/admin/whatsapp/SortControls", () => () => null);

function makeConversation(id: string, startedAt?: string): Conversation {
  const baseTime = startedAt ?? new Date().toISOString();
  return {
    conversationId: id,
    whatsappId: `wa_${id}`,
    leadName: `Lead ${id}`,
    startedAt: baseTime,
    lastReadAt: new Date(Date.now() - 60_000).toISOString(),
    messages: [
      {
        messageId: `${id}-m1` as any,
        timestamp: new Date(Date.now() - 30_000).toISOString(),
        text: `Hello from ${id}`,
        type: "text" as any,
        from: "contact" as any,
      },
    ],
  } as unknown as Conversation;
}

describe("ConversationInbox scroll position", () => {
  test("preserves scrollTop across revalidation (re-render)", () => {
    const conversationsA: Conversation[] = Array.from({ length: 50 }, (_, i) =>
      makeConversation(`c${i + 1}`)
    );

    const { rerender } = render(
      <ConversationInbox
        conversations={conversationsA}
        filters={[]}
        onFiltersChanged={() => {}}
        selectedId={null}
        onSelect={() => {}}
        hasMore={false}
        onLoadMore={() => {}}
        loadingMore={false}
        isLoading={false}
        errorText={null}
        sortOption="recent-desc"
        onSortChange={() => {}}
      />
    );

    const list = screen.getByRole("list");
    const scrollEl = list.parentElement as HTMLElement;
    expect(scrollEl).toBeTruthy();

    // Simulate a scrollable container
    Object.defineProperty(scrollEl, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scrollEl, "scrollHeight", { configurable: true, value: 2000 });

    // Simulate user scrolling down and the component saving scrollTop on scroll
    scrollEl.scrollTop = 500;
    fireEvent.scroll(scrollEl);

    // Re-render with updated conversations (e.g., after SWR revalidation)
    const conversationsB: Conversation[] = conversationsA.map((c, idx) => {
      // Add a new last message to a few conversations to simulate new data
      if (idx % 10 === 0) {
        const next = { ...(c as any) };
        next.messages = [
          ...c.messages,
          {
            messageId: `${c.conversationId}-m2`,
            timestamp: new Date().toISOString(),
            text: `New message for ${c.conversationId}`,
            type: "text",
            from: "contact",
          },
        ];
        return next as Conversation;
      }
      return c;
    });

    rerender(
      <ConversationInbox
        conversations={conversationsB}
        filters={[]}
        onFiltersChanged={() => {}}
        selectedId={null}
        onSelect={() => {}}
        hasMore={false}
        onLoadMore={() => {}}
        loadingMore={false}
        isLoading={false}
        errorText={null}
        sortOption="recent-desc"
        onSortChange={() => {}}
      />
    );

    // The component should restore the previous scrollTop instead of jumping to 0
    expect(scrollEl.scrollTop).toBe(500);
  });
});
