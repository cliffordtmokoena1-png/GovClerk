import type { ReactNode } from "react";

export type FilterType =
  | "startDate"
  | "endDate"
  | "needsFollowup"
  | "minutesDue"
  | "recurringDueOn"
  | "phone"
  | "conversationId"
  | "messageText"
  | "messageCount"
  | "unrepliedTo";

export type FilterValueMap = {
  startDate: Date;
  endDate: Date;
  needsFollowup: boolean;
  minutesDue: Date;
  recurringDueOn: Date;
  phone: string;
  conversationId: string;
  messageText: string;
  messageCount: { op: "<" | "<=" | "==" | ">=" | ">"; count: number };
  unrepliedTo: boolean;
};

export type Filter =
  | { type: "startDate"; value: Date }
  | { type: "endDate"; value: Date }
  | { type: "needsFollowup"; value: boolean }
  | { type: "minutesDue"; value: Date }
  | { type: "recurringDueOn"; value: Date }
  | { type: "phone"; value: string }
  | { type: "conversationId"; value: string }
  | { type: "messageText"; value: string }
  | { type: "messageCount"; value: { op: "<" | "<=" | "==" | ">=" | ">"; count: number } }
  | { type: "unrepliedTo"; value: boolean };

export type FilterPillProps<T> = {
  value: T;
  onRemove: () => void;
};

export type FilterEditorProps<T> = {
  value: T;
  onChange: (next: T) => void;
};

export type FilterDefinition<T> = {
  /** unique key */
  type: FilterType;
  /** label for “Add filter” menu */
  addLabel: string;
  /** default value when user adds this filter */
  defaultValue: () => T;
  /** text shown on the pill */
  formatLabel: (value: T) => string;
  /** render pill + close button, typically wrapped in a PopoverTrigger */
  Pill: (props: FilterPillProps<T>) => ReactNode;
  /** render the editor inside a PopoverContent/Body */
  Editor: (props: FilterEditorProps<T>) => ReactNode;

  /** serialize for URL/API/localStorage */
  toJSON: (value: T) => unknown;
  fromJSON: (raw: unknown) => T;
};
