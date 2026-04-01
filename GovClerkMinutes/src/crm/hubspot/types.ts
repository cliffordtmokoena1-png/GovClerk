import { HUBSPOT_OBJECT_LABELS } from "./consts";

export type HubspotContactProperties =
  | "email"
  | "firstname"
  | "phone"
  | "minutes_frequency"
  | "minutes_due"
  | "user_id"
  | "hubspot_owner_id"
  | "jobtitle"
  | "company"
  | keyof ExtraContactProperties;

export type LeadSource = "gc_landing_page" | "gc_school" | "gc_whatsapp" | "test_source";
export type ExtraContactProperties = {
  lead_source: LeadSource;
};

export type ContactFilter = {
  propertyName: "email" | "user_id" | "phone";
  value: string;
};

export type HubspotObjectLabel = (typeof HUBSPOT_OBJECT_LABELS)[number];
export function isHubspotObjectLabel(label: string): label is HubspotObjectLabel {
  return HUBSPOT_OBJECT_LABELS.includes(label as HubspotObjectLabel);
}

export type HubspotSimplePublicObject = {
  id: string;
  properties: Record<string, string | null>;
};

export enum HubspotFilterOperatorEnum {
  Eq = "EQ",
  Neq = "NEQ",
  Lt = "LT",
  Lte = "LTE",
  Gt = "GT",
  Gte = "GTE",
  Between = "BETWEEN",
  In = "IN",
  NotIn = "NOT_IN",
  HasProperty = "HAS_PROPERTY",
  NotHasProperty = "NOT_HAS_PROPERTY",
  ContainsToken = "CONTAINS_TOKEN",
  NotContainsToken = "NOT_CONTAINS_TOKEN",
}
