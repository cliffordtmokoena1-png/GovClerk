import { VStack } from "@chakra-ui/react";
import { Message, ScheduleRequest, Source } from "@/admin/whatsapp/types";
import ScheduleRequestRow from "./ScheduleRequestRow";
import MessageRow from "./MessageRow";
import AudioMessageRow from "./AudioMessageRow";
import InteractiveCallPermissionReplyRow from "./InteractiveCallPermissionReplyRow";

type Props = {
  messages: Message[];
  scheduleRequests: ScheduleRequest[];
  source: Source;
};

export default function MessageList({ messages, scheduleRequests, source }: Props) {
  const items = [
    ...messages.map((m) => ({
      type: m.type,
      createdAt: m.timestamp,
      data: m,
    })),
    ...scheduleRequests.map((s) => ({
      type: "schedule" as const,
      createdAt: s.createdAt,
      data: s,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <VStack align="stretch" spacing={2}>
      {items.map((item, idx) => {
        switch (item.type) {
          case "text":
            return <MessageRow key={`msg-${idx}`} message={item.data} source={source} />;
          case "template":
            return <MessageRow key={`msg-${idx}`} message={item.data} source={source} />;
          case "call_permission_request":
            return <MessageRow key={`msg-${idx}`} message={item.data} source={source} />;
          case "interactive_call_permission_reply":
            return (
              <InteractiveCallPermissionReplyRow
                key={`msg-${idx}`}
                message={item.data}
                source={source}
                messages={messages}
              />
            );
          case "audio":
            return <AudioMessageRow key={`audio-${idx}`} message={item.data} source={source} />;
          case "schedule":
            return <ScheduleRequestRow key={`sched-${idx}`} scheduleRequest={item.data} />;
          default:
            return null;
        }
      })}
    </VStack>
  );
}
