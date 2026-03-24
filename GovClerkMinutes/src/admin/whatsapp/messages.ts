export type CallPermissionReplyV1 = {
  v: 1;
  type: "call_permission_reply";
  response: "accept" | "reject";
  is_permanent: boolean | null;
  expiration_timestamp: number | null; // seconds epoch
  response_source: "user_action" | "automatic" | null;
  context_id: string | null;
};

export type CallPermissionReplyPayload = CallPermissionReplyV1; // | CallPermissionReplyV2 | ... (future)

export function serializeCallPermissionReplyText(payload: CallPermissionReplyPayload): string {
  return JSON.stringify(payload);
}

export function parseCallPermissionReplyText(text: string): CallPermissionReplyPayload | null {
  const raw = (text || "").trim();
  if (!raw) {
    return null;
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") {
      return null;
    }
    if (obj.v === 1 && obj.type === "call_permission_reply") {
      // Coerce and validate minimally
      const response = String(obj.response) as any;
      const expiration = obj.expiration_timestamp ?? null;
      return {
        v: 1,
        type: "call_permission_reply",
        response,
        is_permanent: obj.is_permanent ?? null,
        expiration_timestamp: expiration,
        response_source: obj.response_source ?? null,
        context_id: obj.context_id ?? null,
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to parse call permission reply text:", err);
    return null;
  }
}
