import { useRef, useMemo } from "react";
import useSWR from "swr";
import type { Conversation } from "@/admin/whatsapp/types";

type useMarkConversationReadParams = {
  conversation: Conversation;
  revalidateWhatsapps: () => void;
};

// Marks a conversation as read by POSTing to `/api/admin/set-whatsapp-conversation-read`.
// Triggers on initial render for a given conversation, and whenever the latest
// message timestamp becomes greater than the last time the API was called.
export default function useMarkConversationRead({
  conversation,
  revalidateWhatsapps,
}: useMarkConversationReadParams) {
  // Track when the API was last invoked (ms since epoch) and whether we've called once
  const lastMarkReadCallAtRef = useRef<number>(0);
  const hasCalledMarkReadOnceRef = useRef<boolean>(false);

  // Track the last conversationId we've processed to reset synchronously during render
  const prevConversationIdRef = useRef<string>(conversation.conversationId);

  // Determine the latest server message timestamp (ms since epoch), if any
  const lastMessage =
    conversation.messages.length > 0
      ? conversation.messages[conversation.messages.length - 1]
      : undefined;
  const latestMessageTsMs = lastMessage?.timestamp ? Date.parse(lastMessage.timestamp) : undefined;

  // Build a key that triggers on initial render and whenever the latest message timestamp
  // increases beyond our last call time
  const markReadKey = useMemo(() => {
    // Synchronously reset tracking when switching conversations so initial key is returned immediately
    if (prevConversationIdRef.current !== conversation.conversationId) {
      lastMarkReadCallAtRef.current = 0;
      hasCalledMarkReadOnceRef.current = false;
      prevConversationIdRef.current = conversation.conversationId;
    }

    if (!hasCalledMarkReadOnceRef.current) {
      return ["whatsapp-mark-read", conversation.conversationId, "initial"] as const;
    }

    if (
      typeof latestMessageTsMs === "number" &&
      latestMessageTsMs > (lastMarkReadCallAtRef.current || 0)
    ) {
      return [
        "whatsapp-mark-read",
        conversation.conversationId,
        String(latestMessageTsMs),
      ] as const;
    }
    return null;
  }, [conversation.conversationId, latestMessageTsMs]);

  useSWR(
    markReadKey,
    async () => {
      try {
        await fetch("/api/admin/set-whatsapp-conversation-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversation.conversationId }),
        });
        await revalidateWhatsapps();
      } finally {
        hasCalledMarkReadOnceRef.current = true;
        if (typeof latestMessageTsMs === "number") {
          lastMarkReadCallAtRef.current = Math.max(
            lastMarkReadCallAtRef.current || 0,
            latestMessageTsMs
          );
        } else {
          lastMarkReadCallAtRef.current = Date.now();
        }
      }
      return null;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
}
