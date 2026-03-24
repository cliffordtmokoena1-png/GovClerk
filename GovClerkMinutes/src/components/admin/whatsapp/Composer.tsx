import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  HStack,
  Textarea,
  IconButton,
  VStack,
  Box,
  useToast,
  Switch,
  Text,
} from "@chakra-ui/react";
import { MdSend } from "react-icons/md";
import { Conversation, Message } from "@/admin/whatsapp/types";
import { getConversationActiveStatus } from "@/admin/whatsapp/utils";
import QuickReplyPicker from "./QuickReplyPicker";

export type OptimisticMessageAction = {
  action: "ADD" | "REMOVE";
  message: Message;
};

type Props = {
  conversation?: Conversation;
  onOptimisticMessage: (action: OptimisticMessageAction) => void;
  // Optional controlled input props for reuse as a simple composer input
  value?: string;
  onChangeText?: (text: string) => void;
  hideSendButton?: boolean;
};

export default function Composer({
  conversation,
  onOptimisticMessage,
  value,
  onChangeText,
  hideSendButton,
}: Props) {
  const [internalText, setInternalText] = useState("");
  const [sending, setSending] = useState(false);
  const [callPermission, setCallPermission] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toast = useToast();

  // Compute active status, but don't return until after hooks are declared
  const status = getConversationActiveStatus(conversation);

  const text = value !== undefined ? value : internalText;
  const setText = useCallback(
    (v: string) => {
      if (onChangeText) {
        onChangeText(v);
      }
      if (value === undefined) {
        setInternalText(v);
      }
    },
    [onChangeText, value]
  );

  // Auto-resize the textarea up to a max height so long messages don't get cut off
  const MAX_TEXTAREA_HEIGHT = 240; // px
  const resizeTextarea = useCallback(() => {
    const textareaEl = textareaRef.current;
    if (!textareaEl) {
      return;
    }
    // Reset to auto to shrink when content is deleted
    textareaEl.style.height = "auto";
    const nextHeight = Math.min(textareaEl.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textareaEl.style.height = `${nextHeight}px`;
    textareaEl.style.overflowY = textareaEl.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const doSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !conversation) {
      return;
    }
    setSending(true);
    setCallPermission(false);
    const optimisticMsg: Message = {
      timestamp: new Date().toISOString(),
      sender: "you",
      text: trimmed,
      type: callPermission ? ("call_permission_request" as const) : ("text" as const),
      direction: "outbound",
    };

    try {
      // Optimistically add the outbound message to the UI immediately
      onOptimisticMessage({
        action: "ADD",
        message: optimisticMsg,
      });

      const res = await fetch("/api/admin/send-whatsapp-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.conversationId,
          whatsappId: conversation.whatsappId,
          businessWhatsappId: conversation.businessWhatsappId,
          source: conversation.source,
          text: trimmed,
          callPermissionRequest: conversation.source === "whatsapp" ? callPermission : false,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed: ${res.status}`);
      }
      setText("");
    } catch (e: any) {
      onOptimisticMessage({ action: "REMOVE", message: optimisticMsg });
      toast({ title: "Failed to send", description: e?.message || "", status: "error" });
      // Don't clear with setText so user can retry
    } finally {
      setSending(false);
    }
  }, [text, sending, conversation, onOptimisticMessage, toast, setText, callPermission]);

  if (!hideSendButton && status.status !== "active") {
    return null;
  }

  return (
    <VStack spacing={2} w="100%" align="stretch">
      <HStack spacing={2} w="100%">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          isDisabled={sending}
          bgColor="white"
          name="message"
          id="composer-textarea"
          lang="en"
          minH="44px"
          pb={6}
          // Improve multi-line usability
          rows={1}
          resize="none"
          onInput={resizeTextarea}
          // Help Grammarly and native spelling tools
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          autoComplete="on"
          inputMode="text"
          onKeyDown={(e) => {
            // Enter to send, Shift+Enter for newline (when send button is shown)
            if (!hideSendButton && e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              doSend();
            }
            // Cmd/Ctrl+Enter also sends
            if (!hideSendButton && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              doSend();
            }
          }}
        />
        {!hideSendButton && (
          <IconButton
            aria-label="Send message"
            icon={<MdSend />}
            colorScheme="whatsapp"
            onClick={doSend}
            isLoading={sending}
            isDisabled={!conversation || status.status !== "active"}
          />
        )}
      </HStack>
      <Box>
        <HStack spacing={2}>
          <QuickReplyPicker
            conversation={conversation}
            onInsert={(insertText) => {
              // Insert at end for simplicity; if controlled, just append
              if (value !== undefined) {
                const next = (text || "").trim().length > 0 ? `${text} ${insertText}` : insertText;
                onChangeText?.(next);
                // Adjust height after external insertion
                requestAnimationFrame(resizeTextarea);
                return;
              }
              const textareaEl = textareaRef.current;
              if (textareaEl && typeof textareaEl.selectionStart === "number") {
                const start = textareaEl.selectionStart;
                const end = textareaEl.selectionEnd ?? start;
                const before = internalText.slice(0, start);
                const after = internalText.slice(end);
                const next = `${before}${insertText}${after}`;
                setInternalText(next);
                // Move cursor after inserted text
                const cursor = start + insertText.length;
                requestAnimationFrame(() => {
                  textareaEl.setSelectionRange(cursor, cursor);
                  textareaEl.focus();
                  resizeTextarea();
                });
              } else {
                setInternalText((prev) =>
                  (prev || "").trim().length > 0 ? `${prev} ${insertText}` : insertText
                );
                requestAnimationFrame(resizeTextarea);
              }
            }}
          />
          {conversation?.source === "whatsapp" && !hideSendButton && (
            <HStack spacing={1} align="center">
              <Switch
                id="call-permission-toggle"
                size="sm"
                colorScheme="green"
                isChecked={callPermission}
                onChange={(e) => setCallPermission(e.target.checked)}
              />
              <Text fontSize="xs" color="gray.600">
                Request call permission
              </Text>
            </HStack>
          )}
        </HStack>
      </Box>
    </VStack>
  );
}
