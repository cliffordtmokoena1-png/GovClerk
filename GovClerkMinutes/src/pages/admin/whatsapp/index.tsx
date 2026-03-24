import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Flex, Text, useBreakpointValue } from "@chakra-ui/react";
import useSWRInfinite from "swr/infinite";
import ConversationInbox from "@/components/admin/whatsapp/ConversationInbox";
import ConversationCard from "@/components/admin/whatsapp/ConversationCard";
import type { Conversation, SortOption, WhatsappWebhook } from "@/admin/whatsapp/types";
import type { Filter } from "@/admin/whatsapp/filter/types";
import { serializeFilters, deserializeFilters } from "@/admin/whatsapp/filter/filters";
import { useUrlState } from "@/hooks/useUrlState";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { useWebSocket } from "@/admin/hooks/useWebSocket";
import type { IncomingMessage } from "@/admin/websocket/types";
import whatsapp from "@/admin/whatsapp/api";
import type { Template } from "@/admin/whatsapp/api/templates";
import ProspectInfoSidebar from "@/components/admin/whatsapp/ProspectInfoSidebar";
import usePlayNotification from "@/admin/whatsapp/hooks/usePlayNotification";
import MobileTabBar from "@/components/admin/whatsapp/MobileTabBar";
import MobileInboxView from "@/components/admin/whatsapp/MobileInboxView";
import MobileChatView from "@/components/admin/whatsapp/MobileChatView";
import AdminPushSubscription from "@/components/AdminPushSubscription";
import { useAnnouncements } from "@/contexts/AnnouncementContext";
import AnnouncementBar from "@/components/AnnouncementBar";
import { useCallEngine } from "@/admin/whatsapp/hooks/useCallEngine";
import CallBox from "@/components/admin/whatsapp/CallBox";
import { useAuth } from "@clerk/nextjs";
import { websocketUri } from "@/utils/server";

const PAGE_SIZE = 30;
const DEFAULT_FILTERS: Filter[] = [];

type PageResult = {
  conversations: Conversation[];
  nextCursor: string | null;
  limit: number;
  total: number;
};

const fetcher = async ([url, body]: [string, any]) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (_context) => {
  const whatsappMessageTemplates = await whatsapp.getTemplates({
    status: "APPROVED",
    fetchAll: true,
  });
  return {
    props: { whatsappMessageTemplates: whatsappMessageTemplates.templates },
  };
});

type Props = {
  whatsappMessageTemplates: Template[];
};

export default function WhatsappTool({ whatsappMessageTemplates }: Props) {
  const [filters, setFilters] = useState<Filter[]>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("recent-desc");
  const [activeMobileTab, setActiveMobileTab] = useState<"inbox" | "chat">("inbox");
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const { addAnnouncement, dismissAnnouncement } = useAnnouncements();
  const wsDisconnectAnnouncementId = useRef<string | null>(null);

  // Keep filters in URL for shareability
  const serializedFilters = useMemo(() => serializeFilters(filters), [filters]);
  useUrlState<Filter[]>({
    param: "f",
    value: filters,
    encode: (v) => serializeFilters(v),
    decode: (s) => {
      try {
        return deserializeFilters(s);
      } catch {
        return [];
      }
    },
    onRead: (incoming) => {
      if (Array.isArray(incoming) && incoming.length > 0) {
        const nextSer = serializeFilters(incoming);
        if (nextSer !== serializedFilters) {
          setFilters(incoming);
        }
      } else {
        setFilters(DEFAULT_FILTERS);
      }
    },
    defaultFromUrlInvalid: () => DEFAULT_FILTERS,
  });

  // Keep selected conversation in URL so refresh stays on the same one
  useUrlState<string>({
    param: "cid",
    value: selectedId ?? "",
    encode: (v) => v,
    decode: (s) => s,
    onRead: (incoming) => {
      // Empty string -> clear selection
      setSelectedId(incoming || null);
    },
    defaultFromUrlInvalid: () => "",
  });

  // Pagination
  const getKey = (pageIndex: number, previousPageData: PageResult | null) => {
    if (previousPageData && previousPageData.nextCursor === null) {
      return null;
    }
    const base: any = { filters: serializedFilters, limit: PAGE_SIZE, sortOption };
    if (pageIndex > 0 && previousPageData?.nextCursor) {
      base.cursor = previousPageData.nextCursor;
    }
    return ["/api/admin/get-whatsapp-conversations", base] as const;
  };

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<PageResult>(getKey, fetcher, {
      revalidateFirstPage: true,
      keepPreviousData: true,
    });

  // Reset pagination and selection when filters change
  useEffect(() => {
    setSize(1);
    mutate();
  }, [serializedFilters, sortOption, setSize, mutate]);

  const { getToken } = useAuth();

  const getUrl = useCallback(async () => {
    const urlBuilder = new URL(websocketUri("/admin/ws", { forceProd: true }));
    const token = await getToken();
    if (token) {
      urlBuilder.searchParams.set("token", token);
    }
    return urlBuilder.toString();
  }, [getToken]);

  const { subscribe } = useWebSocket<IncomingMessage>(getUrl);

  // Incoming call popup state
  const [incomingCall, setIncomingCall] = useState<WhatsappWebhook.CallItem | null>(null);
  // Outbound call UI state: while dialing and after connect
  const [outboundTarget, setOutboundTarget] = useState<{
    to: string;
    from: string;
    name?: string;
  } | null>(null);
  const [outboundCall, setOutboundCall] = useState<WhatsappWebhook.CallItem | null>(null);
  const [outboundStatus, setOutboundStatus] = useState<WhatsappWebhook.CallStatusValue | null>(
    null
  );
  const outboundOpaqueRef = useRef<string | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const engine = useCallEngine({ debug: true, acceptTimeoutMs: 25000 });

  useEffect(() => {
    const unsub = subscribe({
      onMessage: (msg: IncomingMessage) => {
        if (msg.kind === "new_whatsapp") {
          mutate();
        } else if (msg.kind === "call") {
          const kind = msg.data.kind;
          const value = msg.data.value as any;
          if (kind === "calls") {
            const first = (value?.calls ?? [])[0] as WhatsappWebhook.CallItem | undefined;
            if (!first) {
              return;
            }
            if (first.event === "connect" && first.session?.sdp) {
              if (first.direction === "USER_INITIATED") {
                // Inbound call: prompt UI and pre-accept
                setIncomingCall(first);
                try {
                  engine.bind(first.id);
                  engine.preAccept(first.session.sdp, first.to);
                } catch (e) {
                  console.error(e);
                }
              } else if (first.direction === "BUSINESS_INITIATED") {
                // Outbound call: apply ANSWER from webhook and connect
                try {
                  setOutboundCall(first);
                  currentCallIdRef.current = first.id;
                  engine.bind(first.id);
                  engine.applyAnswer({
                    callId: first.id,
                    // Use business phone number from webhook; server maps to phone_number_id
                    phoneNumberId: first.from,
                    answerSdp: first.session.sdp,
                  });
                } catch (e) {
                  console.error(e);
                }
              }
            } else if (first.event === "terminate") {
              engine.terminate().finally(() => {
                setIncomingCall(null);
                setOutboundCall(null);
                setOutboundTarget(null);
                setOutboundStatus(null);
                outboundOpaqueRef.current = null;
                currentCallIdRef.current = null;
              });
            }
          } else if (kind === "statuses") {
            const statuses = (value?.statuses ?? []) as WhatsappWebhook.CallStatusItem[];
            for (const s of statuses) {
              const byId = currentCallIdRef.current && s.id === currentCallIdRef.current;
              const byOpaque =
                outboundOpaqueRef.current &&
                s.biz_opaque_callback_data === outboundOpaqueRef.current;
              if (byId || byOpaque) {
                setOutboundStatus(s.status);
                if (s.status === "REJECTED") {
                  engine.terminate().finally(() => {
                    setIncomingCall(null);
                    setOutboundCall(null);
                    setOutboundTarget(null);
                    setOutboundStatus(null);
                    outboundOpaqueRef.current = null;
                    currentCallIdRef.current = null;
                  });
                }
              }
            }
          }
        }
      },
      onConnect: () => {
        // Refetch data on reconnect
        mutate();

        if (wsDisconnectAnnouncementId.current) {
          dismissAnnouncement(wsDisconnectAnnouncementId.current);
          wsDisconnectAnnouncementId.current = null;
        }
        return () => {
          // This runs on disconnect
          if (wsDisconnectAnnouncementId.current) {
            dismissAnnouncement(wsDisconnectAnnouncementId.current);
          }

          wsDisconnectAnnouncementId.current = addAnnouncement({
            variant: "error",
            text: "Disconnected from server. Attempting to reconnect...",
            dismissible: true,
          });
        };
      },
    });
    return () => unsub();
  }, [mutate, subscribe, dismissAnnouncement, addAnnouncement, engine]);

  const pages = useMemo(() => data ?? [], [data]);
  // accumulate unique conversations by conversationId
  const { byId, conversations } = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const page of pages) {
      for (const c of page.conversations ?? []) {
        if (!map.has(c.conversationId)) {
          map.set(c.conversationId, c);
        }
      }
    }
    return { byId: map, conversations: Array.from(map.values()) };
  }, [pages]);

  // Play notification on new data after revalidation
  usePlayNotification({
    conversations,
    isValidating,
  });

  // Default select first conversation when available
  useEffect(() => {
    if (conversations.length === 0) {
      return;
    }
    if (!selectedId || !byId.get(selectedId)) {
      setSelectedId(conversations[0].conversationId);
    }
  }, [selectedId, conversations, byId]);

  // On mobile, if a conversation is selected (e.g., from URL), show the chat view
  useEffect(() => {
    if (!isDesktop && selectedId) {
      setActiveMobileTab("chat");
    }
  }, [isDesktop, selectedId]);

  const selectedConversation = selectedId ? (byId.get(selectedId) ?? null) : null;
  const lastPage = pages[pages.length - 1];
  const hasMore = !!lastPage?.nextCursor;
  const loadingMore = isValidating && pages.length > 0;

  // Compute unread count for inbox tab badge (count conversations with unread messages)
  const unreadCount = useMemo(() => {
    let count = 0;
    for (const c of conversations) {
      const baseMs = c.lastReadAt ? Date.parse(c.lastReadAt) : undefined;
      let lastReadMs: number | undefined = baseMs;
      // check last message timestamp
      const msgs = c.messages;
      if (msgs && msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        const ms = Date.parse(last.timestamp);
        if (Number.isNaN(lastReadMs as any)) {
          lastReadMs = undefined;
        }
        if (typeof lastReadMs !== "number" || Number.isNaN(lastReadMs)) {
          count++;
        } else if (!Number.isNaN(ms) && ms > lastReadMs) {
          count++;
        }
      }
    }
    return count;
  }, [conversations]);

  // Resolve friendly caller name for incoming call (if any) from known conversations
  const incomingCallerName = useMemo(() => {
    if (!incomingCall) {
      return undefined;
    }
    const match = conversations.find((c) => c.whatsappId === incomingCall.from);
    return match?.leadName;
  }, [conversations, incomingCall]);

  // Define start call handler here so it can use latest conversations
  const handleStartCall = useCallback(
    async (toWaId: string, businessWhatsappId?: string) => {
      if (!businessWhatsappId) {
        console.error("Missing businessWhatsappId for outbound call");
        return;
      }
      try {
        // Show CallBox immediately in dialing state
        const friendly = conversations.find((c) => c.whatsappId === toWaId)?.leadName;
        setOutboundTarget({ to: toWaId, from: businessWhatsappId, name: friendly });
        const opaque = `conv:${toWaId}:${Date.now()}`;
        outboundOpaqueRef.current = opaque;
        setOutboundStatus(null);
        // startOutbound will create offer and POST connect; the Answer will arrive via webhook
        // and be applied in the websocket handler below
        await engine.startOutbound({
          toWaId,
          phoneNumberId: businessWhatsappId,
          bizOpaque: opaque,
        });
      } catch (e) {
        console.error("Failed to start outbound call", e);
        // Hide callbox if we failed to start
        setOutboundTarget(null);
        setOutboundCall(null);
        setOutboundStatus(null);
        outboundOpaqueRef.current = null;
        currentCallIdRef.current = null;
      }
    },
    [conversations, engine]
  );

  // Hide call box when engine ends or errors out
  useEffect(() => {
    if (engine.state === "ENDED" || engine.state === "ERROR") {
      setIncomingCall(null);
      setOutboundCall(null);
      setOutboundTarget(null);
    }
  }, [engine.state]);

  return (
    <>
      <Head>
        <title>WhatsApp Inbox · Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AnnouncementBar />
      {/* Call popup: inbound or outbound */}
      {(incomingCall || outboundTarget || outboundCall) && (
        <CallBox
          call={incomingCall ?? outboundCall ?? undefined}
          target={outboundTarget ? { from: outboundTarget.from, to: outboundTarget.to } : undefined}
          engineState={engine.state}
          callerName={incomingCall ? incomingCallerName : outboundTarget?.name}
          isOutbound={Boolean(
            (outboundCall && outboundCall.direction === "BUSINESS_INITIATED") ||
              (!!outboundTarget && !incomingCall)
          )}
          status={outboundStatus ?? undefined}
          setMicDevice={engine.setInputDevice}
          onAccept={() => engine.accept()}
          onReject={() => {
            const doEnd = Boolean(
              (outboundCall && outboundCall.direction === "BUSINESS_INITIATED") ||
                (!!outboundTarget && !incomingCall)
            );
            const fn = doEnd ? engine.terminate : engine.reject;
            fn().finally(() => {
              setIncomingCall(null);
              setOutboundCall(null);
              setOutboundTarget(null);
              setOutboundStatus(null);
              outboundOpaqueRef.current = null;
              currentCallIdRef.current = null;
            });
          }}
          onDismiss={() => {
            engine.endLocal();
            setIncomingCall(null);
            setOutboundCall(null);
            setOutboundTarget(null);
            setOutboundStatus(null);
            outboundOpaqueRef.current = null;
            currentCallIdRef.current = null;
          }}
        />
      )}
      {/* Ensure admin device subscribes to push notifications */}
      <AdminPushSubscription enabled />
      {/* Hidden audio element to ensure remote media can play for outbound calls too */}
      <audio id="mg-wa-call-audio" autoPlay playsInline style={{ display: "none" }} />
      {/* Desktop layout (md+) remains unchanged */}
      {isDesktop ? (
        <Flex gap={4} align="stretch" h="100dvh" overflow="hidden">
          {/* Sidebar */}
          <Box
            w={{ base: "100%", md: "25%" }}
            maxW={{ base: "100%", md: "420px" }}
            minW={{ base: "100%", md: "280px" }}
            flexShrink={0}
            position={{ base: "static", md: "sticky" }}
            top={{ base: undefined, md: 0 }}
            alignSelf="flex-start"
            h={{ base: "auto", md: "100dvh" }}
            maxH={{ base: "auto", md: "100dvh" }}
            overflowY={{ base: "visible", md: "auto" }}
            pl={2}
          >
            <ConversationInbox
              conversations={conversations}
              filters={filters}
              onFiltersChanged={setFilters}
              selectedId={selectedId}
              onSelect={setSelectedId}
              hasMore={hasMore}
              onLoadMore={() => setSize(size + 1)}
              loadingMore={loadingMore}
              isLoading={isLoading}
              errorText={error ? "Failed to load conversations." : null}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />
          </Box>

          {/* Main panel */}
          <Box
            flex={1}
            minW={0}
            w={{ base: "100%", md: "75%" }}
            h="100dvh"
            overflow="hidden"
            display="flex"
            flexDirection="column"
          >
            {selectedConversation ? (
              <ConversationCard
                key={selectedConversation.conversationId}
                conversation={selectedConversation}
                whatsappMessageTemplates={whatsappMessageTemplates}
                isSelected={false}
                onToggleSelected={() => {}}
                revalidateWhatsapps={() => mutate()}
                autoScrollToBottom
                hideProspectInfo
                onStartCall={(args: { toWaId: string; phoneNumberId?: string }) =>
                  handleStartCall(args.toWaId, args.phoneNumberId)
                }
              />
            ) : (
              <Box
                h="full"
                borderWidth="1px"
                borderRadius="lg"
                bg="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="gray.500"
              >
                <Text fontSize="sm">Select a conversation from the left.</Text>
              </Box>
            )}
          </Box>

          <ProspectInfoSidebar conversation={selectedConversation} />
        </Flex>
      ) : (
        // Mobile layout (base, sm): single pane + bottom tab bar
        <Box position="relative" h="100dvh" overflow="hidden">
          <Box h="100%" pb="72px">
            {/* space for bottom bar */}
            {activeMobileTab === "inbox" ? (
              <MobileInboxView
                conversations={conversations}
                filters={filters}
                onFiltersChanged={setFilters}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setActiveMobileTab("chat");
                }}
                hasMore={hasMore}
                onLoadMore={() => setSize(size + 1)}
                loadingMore={loadingMore}
                isLoading={isLoading}
                errorText={error ? "Failed to load conversations." : null}
                sortOption={sortOption}
                onSortChange={setSortOption}
              />
            ) : (
              <MobileChatView
                key={selectedConversation?.conversationId || "none"}
                conversation={selectedConversation}
                whatsappMessageTemplates={whatsappMessageTemplates}
                onBack={() => setActiveMobileTab("inbox")}
                onRevalidate={() => mutate()}
                onStartCall={({ toWaId, phoneNumberId }) => handleStartCall(toWaId, phoneNumberId)}
              />
            )}
          </Box>

          <MobileTabBar
            activeTab={activeMobileTab}
            onChange={setActiveMobileTab}
            unreadCount={unreadCount}
          />
        </Box>
      )}
    </>
  );
}
