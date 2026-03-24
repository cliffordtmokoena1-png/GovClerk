export const HUBSPOT_OWNER_IDS = {
  MAX_SHERMAN: {
    id: "80634044",
    email: "cliff@govclerkminutes.com",
    firstname: "Max",
    lastname: "Sherman",
    name(): string {
      return `${this.firstname} ${this.lastname}`;
    },
  },
  CLIFF_MOKOENA: {
    id: "159503324",
    email: "cliff@GovClerkMinutes.com",
    firstname: "Cliff",
    lastname: "Mokoena",
    name(): string {
      return `${this.firstname} ${this.lastname}`;
    },
  },
};

// Adding this email as BCC logs the email to Hubspot
export const OUTGOING_BCC_EMAIL = "242974326@bcc.na2.hubspot.com";

export const HUBSPOT_OBJECT_LABELS = ["contacts", "tasks", "emails", "communications"] as const;

export const HUBSPOT_REGION = "app-na2";
export const HUBSPOT_INSTANCE_ID = 242974326;
