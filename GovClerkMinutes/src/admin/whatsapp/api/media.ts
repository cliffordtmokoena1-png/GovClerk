import { assertString } from "@/utils/assert";
import { WHATSAPP_API_VERSION, getPhoneNumberIdFor } from "./consts";

// --- Types ---

export interface UploadMediaParams {
  // Binary data to upload. Accepts Blob, ArrayBuffer, Uint8Array, or Node Buffer.
  data: Blob | ArrayBuffer | Uint8Array | Buffer;
  // MIME type, e.g. "audio/ogg; codecs=opus", "image/png", "video/mp4"
  mimeType: string;
  // Filename used for the multipart form; does not affect content, but Meta prefers a sensible name.
  filename: string;
  // Business WhatsApp phone number (digits only)
  businessWhatsappId: string;
  // Optional override; defaults to env META_WHATSAPP_BUSINESS_API_KEY
  accessToken?: string;
}

export interface UploadMediaResponse {
  id: string;
  raw: any;
}

export interface GetMediaUrlParams {
  mediaId: string;
}

export interface MediaUrlResponse {
  messaging_product: "whatsapp" | string;
  url: string;
  mime_type: string;
  sha256?: string;
  file_size?: string | number;
  id: string;
  raw: any;
}

export interface DeleteMediaParams {
  mediaId: string;
  businessWhatsappId: string;
  accessToken?: string;
}

export interface DeleteMediaResponse {
  success: boolean;
  raw: any;
}

export interface DownloadMediaParams {
  mediaUrl: string;
}

export interface DownloadMediaResponse {
  data: ArrayBuffer;
  contentType?: string;
  contentLength?: number;
}

// --- Helpers ---

function toBlob(data: UploadMediaParams["data"], mimeType: string): Blob {
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    // Ensure the blob has the correct type; if not, wrap it.
    if ((data as Blob).type && (data as Blob).type === mimeType) {
      return data as Blob;
    }
    return new Blob([data as any], { type: mimeType });
  }
  // Node/ArrayBuffer/Uint8Array path
  return new Blob([data as any], { type: mimeType });
}

// --- API functions ---

// Upload media to WhatsApp Cloud API. Media persists ~30 days unless deleted earlier.
export async function uploadMedia(params: UploadMediaParams): Promise<UploadMediaResponse> {
  const phoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const accessToken =
    params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/media`;

  // Build multipart form
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  // Some docs mention a separate 'type' param; include it for safety/compat.
  form.append("type", params.mimeType);
  const blob = toBlob(params.data, params.mimeType);
  // Attaching as a File name helps diagnostics; Blob + filename is accepted by undici
  form.append("file", blob, params.filename);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Let fetch set Content-Type with form boundary automatically
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload media: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { id: data.id, raw: data };
}

// Retrieve short-lived URL and metadata for an uploaded media by its media ID.
export async function getMediaUrl(params: GetMediaUrlParams): Promise<MediaUrlResponse> {
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${params.mediaId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY)}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get media URL: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    messaging_product: data.messaging_product,
    url: data.url,
    mime_type: data.mime_type,
    sha256: data.sha256,
    file_size: data.file_size,
    id: data.id,
    raw: data,
  };
}

// Delete a specific media by its media ID.
export async function deleteMedia(params: DeleteMediaParams): Promise<DeleteMediaResponse> {
  const accessToken =
    params.accessToken || assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY);
  const resolvedPhoneNumberId = getPhoneNumberIdFor(params.businessWhatsappId);
  const qp = resolvedPhoneNumberId
    ? `?phone_number_id=${encodeURIComponent(resolvedPhoneNumberId)}`
    : "";
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${params.mediaId}${qp}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to delete media: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { success: Boolean(data.success), raw: data };
}

// Download media binary using the short-lived media URL.
export async function downloadMedia(params: DownloadMediaParams): Promise<DownloadMediaResponse> {
  const res = await fetch(params.mediaUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${assertString(process.env.META_WHATSAPP_BUSINESS_API_KEY)}`,
    },
  });

  if (!res.ok) {
    // Per docs, 404 can happen if URL expired; callers should fetch a fresh URL and retry
    throw new Error(`Failed to download media: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || undefined;
  const contentLength = Number(res.headers.get("content-length") || "0") || undefined;
  const data = await res.arrayBuffer();
  return { data, contentType, contentLength };
}
