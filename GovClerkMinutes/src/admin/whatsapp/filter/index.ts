import type { Filter, FilterDefinition, FilterType } from "./types";
import StartDate from "./startDate";
import EndDate from "./endDate";
import NeedsFollowup from "./needsFollowup";
import MinutesDue from "./minutesDue";
import RecurringDueOn from "./recurringDueOn";
import MessageText from "./messageText";
import MessageCount from "./messageCount";
import UnrepliedTo from "./unrepliedTo";
import Phone from "./phone";
import ConversationId from "./conversationId";

const defs = [
  StartDate,
  EndDate,
  NeedsFollowup,
  MinutesDue,
  RecurringDueOn,
  Phone,
  ConversationId,
  MessageText,
  MessageCount,
  UnrepliedTo,
] as const;

export const FILTER_REGISTRY: Record<FilterType, FilterDefinition<any>> = Object.fromEntries(
  defs.map((d) => [d.type, d])
) as any;

export const ADD_MENU = defs.map((d) => ({ type: d.type, label: d.addLabel }));

export function defaultValueFor(type: FilterType): Filter {
  const def = FILTER_REGISTRY[type];
  return { type, value: def.defaultValue() } as Filter;
}
