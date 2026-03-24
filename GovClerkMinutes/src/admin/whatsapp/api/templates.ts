import { assertString } from "@/utils/assert";
import { WHATSAPP_API_VERSION, WHATSAPP_BUSINESS_ACCOUNT_ID, getPhoneNumberIdFor } from "./consts";
import { writeMessageToDb } from "./messages";
import requestSendPush from "@/push/requestSendPush";

// Status values per WhatsApp Cloud API docs
export type TemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PENDING_DELETION"
  | "PAUSED"
  | "LIMIT_REACHED";

export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION" | string;

export interface TemplateComponentButton {
  type: string;
  text?: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateComponent {
  type: string; // HEADER | BODY | FOOTER | BUTTONS
  format?: string; // HEADER format (IMAGE|TEXT|DOCUMENT|VIDEO|LOCATION)
  text?: string;
  example?: any; // Keep loose for now; can be refined later
  buttons?: TemplateComponentButton[];
}

export interface Template {
  id: string;
  name: string;
  language: string;
  status: TemplateStatus;
  category?: TemplateCategory;
  sub_category?: string;
  parameter_format?: "NAMED" | "POSITIONAL";
  components?: TemplateComponent[];
}

export interface GetTemplatesParams {
  status?: TemplateStatus;
  fields?: string[]; // e.g. ["name","category","status"]
  limit?: number; // page size (1-250 typical)
  after?: string; // cursor for pagination
  before?: string; // backwards cursor
  fetchAll?: boolean; // follow paging automatically and aggregate results (ignored if limit explicitly provided and after/before set)
  businessAccountId?: string; // override default business account id
  accessToken?: string; // override token (otherwise META_WHATSAPP_BUSINESS_API_KEY is used)
}

export interface TemplatesPage {
  data: Template[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
  // Raw full JSON for debugging
  raw: any;
}

export interface GetTemplatesResult {
  templates: Template[];
  // If fetchAll=false we also return paging to allow caller to paginate manually
  paging?: TemplatesPage["paging"];
  rawPages: any[]; // each raw page JSON (always array even if single page)
}

// --- Sending template messages (text-based only) ---
// We support two parameter styles: named (object with name,value) and positional (array order) matching the
// template's parameter_format. Caller must provide language code (e.g. en_US) because the API requires it.
export type NamedTemplateParameter = { name: string; value: string };
export type PositionalTemplateParameter = string;

export interface SendTemplateMessageParamsBase {
  to: string; // destination phone number (MSISDN without +) per existing usage style
  templateName: string;
  templateBody: string;
  adminUserId: string;
  language: string; // e.g. en_US
  accessToken?: string; // override token
  businessWhatsappId: string;
}

export interface SendNamedTemplateMessageParams extends SendTemplateMessageParamsBase {
  parameterFormat: "NAMED";
  parameters: NamedTemplateParameter[];
}

export interface SendPositionalTemplateMessageParams extends SendTemplateMessageParamsBase {
  parameterFormat: "POSITIONAL";
  parameters: PositionalTemplateParameter[];
}

export type SendTemplateMessageParams =
  | SendNamedTemplateMessageParams
  | SendPositionalTemplateMessageParams;

export interface SendTemplateMessageResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  raw: any;
}

// Extract unique placeholder names from a template body for NAMED format, in first-seen order
function extractNamedBodyPlaceholders(templateBody: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const re = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateBody))) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

// Extract unique positional indices from a template body for POSITIONAL format, ordered by first-seen, 1-based
function extractPositionalBodyPlaceholders(templateBody: string): number[] {
  const idxs: number[] = [];
  const seen = new Set<number>();
  const re = /{{\s*(\d+)\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateBody))) {
    const idx = Number(m[1]);
    if (Number.isFinite(idx) && idx >= 1 && !seen.has(idx)) {
      seen.add(idx);
      idxs.push(idx);
    }
  }
  return idxs;
}

function buildTemplateComponents(params: SendTemplateMessageParams) {
  // We only build BODY parameters here. WhatsApp Cloud API expects the number of
  // parameters for the body to match the placeholders present in the body.
  // If callers provide extras (e.g., header/button vars), we must NOT include
  // them in the body component, or the API returns 132000.
  if (params.parameterFormat === "NAMED") {
    if (params.parameters.length === 0) {
      return [];
    }
    // Limit to the named variables that actually appear in the body
    const bodyVarNames = extractNamedBodyPlaceholders(params.templateBody);
    if (bodyVarNames.length === 0) {
      return [];
    }
    const allowed = new Set(bodyVarNames);
    const filtered = (params.parameters as NamedTemplateParameter[]).filter((p) =>
      allowed.has(p.name)
    );
    if (filtered.length === 0) {
      return [];
    }
    return [
      {
        type: "body",
        parameters: filtered.map((p) => ({
          type: "text",
          parameter_name: p.name,
          text: p.value,
        })),
      },
    ];
  }

  // POSITIONAL
  if (params.parameters.length === 0) {
    return [];
  }
  const positionalValues = params.parameters as string[];
  const bodyIdxs = extractPositionalBodyPlaceholders(params.templateBody);
  if (bodyIdxs.length === 0) {
    return [];
  }
  // Map the indices found in the body (1-based) to provided values; skip undefined
  const bodyParameters = bodyIdxs
    .map((idx) => positionalValues[idx - 1])
    .filter((v): v is string => typeof v === "string");

  if (bodyParameters.length === 0) {
    return [];
  }

  return [
    {
      type: "body",
      parameters: bodyParameters.map((value) => ({
        type: "text",
        text: value,
      })),
    },
  ];
}

// Replace placeholders in the template body with provided parameters so we can persist
// a human-readable text of what was sent. This does not affect what is sent via Cloud API
// (we send parameters separately in the components array). This is only for logging.
function renderTemplateBody(templateBody: string, params: SendTemplateMessageParams): string {
  // Named format: {{name}} -> value
  if (params.parameterFormat === "NAMED") {
    const map = new Map<string, string>();
    for (const p of params.parameters) {
      // Store as-is; template variables are typically lowercase with underscores
      map.set(p.name, p.value);
    }
    return templateBody.replace(/{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g, (_m, name: string) => {
      const replacement = map.get(name);
      return typeof replacement === "string" ? replacement : _m;
    });
  }

  // Positional format: {{1}}, {{2}}, ... -> parameters[0], parameters[1], ...
  const values = params.parameters as string[];
  return templateBody.replace(/{{\s*(\d+)\s*}}/g, (_m, idxStr: string) => {
    const idx = Number(idxStr);
    if (!Number.isFinite(idx) || idx < 1) {
      return _m;
    }
    const value = values[idx - 1];
    return typeof value === "string" ? value : _m;
  });
}

export async function sendTemplateMessage(
  params: SendTemplateMessageParams
): Promise<SendTemplateMessageResponse> {
  const accessToken =
    params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  const bodyPayload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.language },
    },
  };

  const components = buildTemplateComponents(params);
  if (components.length > 0) {
    bodyPayload.template.components = components;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    throw new Error(`Failed to send template message: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = renderTemplateBody(params.templateBody, params);

  await writeMessageToDb({
    adminUserId: params.adminUserId,
    messageId: data.messages?.[0]?.id ?? "",
    whatsappId: params.to,
    businessWhatsappId: params.businessWhatsappId,
    text,
    type: "template",
  });

  await requestSendPush({
    title: "Scheduled Message Sent",
    body: text,
    url: "/admin/whatsapp",
    tag: "mg-whatsapp",
  });

  return {
    messaging_product: data.messaging_product,
    contacts: data.contacts,
    messages: data.messages,
    raw: data,
  };
}

function buildQuery(params: GetTemplatesParams, businessAccountId: string): string {
  const query = new URLSearchParams();
  if (params.fields?.length) {
    query.set("fields", params.fields.join(","));
  }
  if (params.status) {
    // API expects lowercase (e.g. approved, rejected). Examples show lowercase in query param.
    query.set("status", params.status.toLowerCase());
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  if (params.after) {
    query.set("after", params.after);
  }
  if (params.before) {
    query.set("before", params.before);
  }
  const qs = query.toString();
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${businessAccountId}/message_templates${qs ? `?${qs}` : ""}`;
}

async function fetchPage(url: string, accessToken: string): Promise<TemplatesPage> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch templates: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return {
    data: json.data as Template[],
    paging: json.paging,
    raw: json,
  };
}

export async function getTemplates(params: GetTemplatesParams = {}): Promise<GetTemplatesResult> {
  const businessAccountId = params.businessAccountId || WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken =
    params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);

  const firstUrl = buildQuery(params, businessAccountId);
  const allTemplates: Template[] = [];
  const rawPages: any[] = [];

  // If fetchAll requested, we iterate follow 'next'. Otherwise just single page.
  let url: string | undefined = firstUrl;
  let paging: TemplatesPage["paging"] | undefined;
  let safety = 0; // guard against infinite loops

  while (url) {
    const page = await fetchPage(url, accessToken);
    rawPages.push(page.raw);
    allTemplates.push(...page.data);
    paging = page.paging;

    if (!params.fetchAll) {
      // Only fetch first page if not aggregating
      break;
    }
    url = page.paging?.next;
    if (url) {
      safety++;
      if (safety > 50) {
        throw new Error("Aborting getTemplates after 50 pages (safety limit)");
      }
    }
  }

  return {
    templates: allTemplates,
    paging: params.fetchAll ? undefined : paging,
    rawPages,
  };
}
