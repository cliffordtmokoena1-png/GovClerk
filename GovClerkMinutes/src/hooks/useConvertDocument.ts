import { useCallback } from "react";
import useSWRMutation from "swr/mutation";
import { safeCapture } from "@/utils/safePosthog";
import { serverUri } from "@/utils/server";
import { useAuth } from "@clerk/nextjs";
import { assertString } from "@/utils/assert";

type InputType = string;
export type OutputType = "docx" | "odt" | "html" | "pdf";

type ConvertArgs = {
  token: string;
  input: Blob;
  outputType: OutputType;
  inputType?: InputType;
};

type ConvertParams = {
  input: Blob;
  outputType: OutputType;
  inputType?: InputType;
};

type ConvertImagesParams = {
  urls: string[];
  outputType: OutputType;
};

type UseConvertDocumentReturn = {
  convert: (params: ConvertParams) => Promise<Blob | undefined>;
  isLoading: boolean;
  error: Error | null;
  blob: Blob | null;
  reset: () => void;
};

type UseConvertImagesReturn = Omit<UseConvertDocumentReturn, "convert"> & {
  convertImages: (params: ConvertImagesParams) => Promise<Blob | undefined>;
};

const endpoint = serverUri("/api/convert-document");

// POST multipart/form-data: file + output_type + optional input_type
async function convertDocument(url: string, { arg }: { arg: ConvertArgs }): Promise<Blob> {
  const form = new FormData();
  form.append("file", arg.input, "input");
  form.append("output_type", arg.outputType);
  if (arg.inputType) {
    form.append("input_type", arg.inputType);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${arg.token}`,
      },
      body: form,
    });
  } catch (networkError) {
    safeCapture("export_to_word_failed", { error: String(networkError), url });
    throw new Error(`Network error contacting ${url}: ${networkError}`);
  }

  if (!res.ok) {
    const error = await res.text();
    safeCapture("export_to_word_failed", { error, status: res.status, url });
    throw new Error(
      error || `Failed to convert document — ${res.status} ${res.statusText} (${url})`
    );
  }

  return res.blob();
}

/**
 * Hook to convert a document using the server API.
 * Returns a `convert` trigger along with loading/error/data state.
 */
export function useConvertDocument(): UseConvertDocumentReturn {
  const { getToken } = useAuth();

  const { trigger, isMutating, data, error, reset } = useSWRMutation<
    Blob,
    Error,
    string,
    ConvertArgs
  >(endpoint, convertDocument);

  const convert = useCallback(
    async ({ input, outputType, inputType }: ConvertParams) => {
      const token = await getToken();
      return trigger({ token: assertString(token), input, outputType, inputType });
    },
    [trigger, getToken]
  );

  return {
    convert,
    isLoading: isMutating,
    error: error ?? null,
    blob: data ?? null,
    reset,
  };
}

/**
 * Hook to convert a set of image URLs to a document.
 * Builds a markdown document with image tags and delegates to useConvertDocument.
 */
export function useConvertImages(): UseConvertImagesReturn {
  const { convert, ...rest } = useConvertDocument();

  async function blobUrlToDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mime = response.headers.get("Content-Type") || "application/octet-stream";
    return `data:${mime};base64,${base64}`;
  }

  const convertImages = useCallback(
    async ({ urls, outputType }: ConvertImagesParams) => {
      const normalizedUrls = await Promise.all(
        urls.map((url) => (url.startsWith("blob:") ? blobUrlToDataUrl(url) : Promise.resolve(url)))
      );
      const markdown = normalizedUrls.map((url, i) => `![Image ${i + 1}](${url})`).join("\n");
      const input = new Blob([markdown], { type: "text/markdown" });
      return convert({ input, outputType, inputType: "gfm" });
    },
    [convert]
  );

  return {
    convertImages,
    ...rest,
  };
}
