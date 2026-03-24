import { assertString } from "@/utils/assert";
import { WHATSAPP_API_VERSION, WHATSAPP_BUSINESS_ACCOUNT_ID } from "./consts";

export interface RequestVerificationCodeParams {
  phoneNumberId: string; // Cloud API phone number id
  codeMethod: "SMS" | "VOICE"; // must be uppercase per docs
  language: string; // two-char language code, e.g. "en"
  accessToken?: string; // override; defaults to META_WHATSAPP_BUSINESS_API_KEY
}

export interface VerifyCodeParams {
  phoneNumberId: string;
  code: string; // numeric string code
  accessToken?: string;
}

export interface SimpleSuccessResponse {
  success?: boolean;
  raw: any;
}

export interface GetPhoneNumbersParams {
  businessAccountId?: string; // defaults to WHATSAPP_BUSINESS_ACCOUNT_ID if omitted
  accessToken?: string; // override access token
}

export interface PhoneNumberEntry {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  [key: string]: any; // allow passthrough of additional metadata
}

export interface GetPhoneNumbersResult {
  data: PhoneNumberEntry[];
  raw: any;
}

export interface RegisterPhoneNumberParams {
  phoneNumberId: string;
  pin: string; // 6-digit numeric string
  dataLocalizationRegion?: string; // Optional 2-letter ISO 3166 code (e.g., CH)
  accessToken?: string; // override token
}

/**
 * POST /{PHONE_NUMBER_ID}/request_code
 * Docs: Verify Phone Numbers (Cloud API)
 */
export async function requestVerificationCode(
  params: RequestVerificationCodeParams
): Promise<SimpleSuccessResponse> {
  const token = params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${params.phoneNumberId}/request_code`;

  const form = new URLSearchParams();
  form.set("code_method", params.codeMethod);
  form.set("language", params.language);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Failed to request verification code: ${res.status} ${await res.text()}`);
  }
  const json = await res.json().catch(() => ({}));
  return { success: (json as any)?.success, raw: json };
}

/**
 * POST /{PHONE_NUMBER_ID}/verify_code
 * Docs: Verify Phone Numbers (Cloud API)
 */
export async function verifyCode(params: VerifyCodeParams): Promise<SimpleSuccessResponse> {
  const token = params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${params.phoneNumberId}/verify_code`;

  const form = new URLSearchParams();
  form.set("code", params.code);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Failed to verify code: ${res.status} ${await res.text()}`);
  }
  const json = await res.json().catch(() => ({}));
  return { success: (json as any)?.success, raw: json };
}

/**
 * GET /{WABA_ID}/phone_numbers
 * Docs: Retrieve Phone Numbers (Business Management API)
 */
export async function getPhoneNumbers(
  params: GetPhoneNumbersParams = {}
): Promise<GetPhoneNumbersResult> {
  const token = params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const businessAccountId = params.businessAccountId || WHATSAPP_BUSINESS_ACCOUNT_ID;

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${businessAccountId}/phone_numbers`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve phone numbers: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const list = (json?.data ?? []) as PhoneNumberEntry[];
  return { data: list, raw: json };
}

/**
 * POST /{PHONE_NUMBER_ID}/register
 * Docs: Register a Business Phone Number (Cloud API)
 */
export async function registerPhoneNumber(
  params: RegisterPhoneNumberParams
): Promise<SimpleSuccessResponse> {
  const token = params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${params.phoneNumberId}/register`;

  const body: Record<string, any> = {
    messaging_product: "whatsapp",
    pin: params.pin,
  };
  if (params.dataLocalizationRegion) {
    body.data_localization_region = params.dataLocalizationRegion;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to register phone number: ${res.status} ${await res.text()}`);
  }
  const json = await res.json().catch(() => ({}));
  return { success: (json as any)?.success, raw: json };
}
