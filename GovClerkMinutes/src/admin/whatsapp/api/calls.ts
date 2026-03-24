import { assertString } from "@/utils/assert";
import { WHATSAPP_API_VERSION, getPhoneNumberIdFor } from "./consts";

export type CallAction = "connect" | "pre_accept" | "accept" | "reject" | "terminate";

export type SdpType = "offer" | "answer";

export interface CallSessionPayload {
  sdp_type: SdpType;
  sdp: string;
}

export interface BaseCallRequestBody {
  messaging_product: "whatsapp";
  call_id: string;
  action: CallAction;
}

export interface PreAcceptCallParams {
  callId: string;
  session: CallSessionPayload; // answer SDP on business side
  accessToken?: string;
  businessWhatsappId: string;
}

export interface AcceptCallParams {
  callId: string;
  session: CallSessionPayload; // answer SDP on business side
  bizOpaqueCallbackData?: string;
  accessToken?: string;
  businessWhatsappId: string;
}

export interface RejectCallParams {
  callId: string;
  accessToken?: string;
  businessWhatsappId: string;
}

export interface TerminateCallParams {
  callId: string;
  accessToken?: string;
  businessWhatsappId: string;
}

export interface ConnectCallParams {
  to: string; // callee WhatsApp id (digits only)
  session: CallSessionPayload; // offer SDP on business side
  bizOpaqueCallbackData?: string;
  accessToken?: string;
  businessWhatsappId: string; // business number (digits)
}

export interface CallActionResponse {
  messaging_product: string;
  success: boolean;
  raw: any;
}

async function postCallsEndpoint(
  phoneNumberId: string,
  body: Record<string, any>,
  accessToken?: string
) {
  const token = accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/calls`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed Calls API request: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json;
}

export async function connectCall(
  params: ConnectCallParams
): Promise<{ callId: string; raw: any }> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const payload = {
    messaging_product: "whatsapp" as const,
    to: params.to,
    action: "connect" as const,
    session: params.session,
    biz_opaque_callback_data: params.bizOpaqueCallbackData,
  };
  const json = await postCallsEndpoint(phoneNumberId, payload, params.accessToken);
  const callId = json?.calls?.[0]?.id || json?.id;
  if (!callId) {
    throw new Error("Missing call id in connect response");
  }
  return { callId, raw: json };
}

export async function preAcceptCall(params: PreAcceptCallParams): Promise<CallActionResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const payload: BaseCallRequestBody & { session: CallSessionPayload } = {
    messaging_product: "whatsapp",
    call_id: params.callId,
    action: "pre_accept",
    session: params.session,
  };
  const json = await postCallsEndpoint(phoneNumberId, payload, params.accessToken);
  return {
    messaging_product: json.messaging_product ?? "whatsapp",
    success: Boolean(json.success),
    raw: json,
  };
}

export async function acceptCall(params: AcceptCallParams): Promise<CallActionResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const payload: BaseCallRequestBody & {
    session: CallSessionPayload;
    biz_opaque_callback_data?: string;
  } = {
    messaging_product: "whatsapp",
    call_id: params.callId,
    action: "accept",
    session: params.session,
    biz_opaque_callback_data: params.bizOpaqueCallbackData,
  };
  const json = await postCallsEndpoint(phoneNumberId, payload, params.accessToken);
  return {
    messaging_product: json.messaging_product ?? "whatsapp",
    success: Boolean(json.success),
    raw: json,
  };
}

export async function rejectCall(params: RejectCallParams): Promise<CallActionResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const payload: BaseCallRequestBody = {
    messaging_product: "whatsapp",
    call_id: params.callId,
    action: "reject",
  };
  const json = await postCallsEndpoint(phoneNumberId, payload, params.accessToken);
  return {
    messaging_product: json.messaging_product ?? "whatsapp",
    success: Boolean(json.success),
    raw: json,
  };
}

export async function terminateCall(params: TerminateCallParams): Promise<CallActionResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const payload: BaseCallRequestBody = {
    messaging_product: "whatsapp",
    call_id: params.callId,
    action: "terminate",
  };
  const json = await postCallsEndpoint(phoneNumberId, payload, params.accessToken);
  return {
    messaging_product: json.messaging_product ?? "whatsapp",
    success: Boolean(json.success),
    raw: json,
  };
}
