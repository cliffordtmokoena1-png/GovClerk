import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { debounce } from "@/utils/debounce";

export function useUrlState<T>({
  param,
  value,
  encode,
  decode,
  onRead,
  defaultFromUrlInvalid,
  shallow = true,
  debounceMs = 150,
}: {
  param: string;
  value: T;
  encode: (v: T) => string;
  decode: (s: string) => T;
  onRead?: (v: T) => void;
  defaultFromUrlInvalid?: () => T;
  shallow?: boolean;
  debounceMs?: number;
}) {
  const router = useRouter();
  const isHydratingFromUrl = useRef(false);

  // Keep latest callbacks in refs so effect deps don't thrash on identity changes
  const encodeRef = useRef(encode);
  const decodeRef = useRef(decode);
  const onReadRef = useRef(onRead);
  const defaultFromUrlInvalidRef = useRef(defaultFromUrlInvalid);
  const lastEncodedRef = useRef<string>("");

  useEffect(() => {
    encodeRef.current = encode;
  }, [encode]);
  useEffect(() => {
    decodeRef.current = decode;
  }, [decode]);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);
  useEffect(() => {
    defaultFromUrlInvalidRef.current = defaultFromUrlInvalid;
  }, [defaultFromUrlInvalid]);

  // Track latest encoded value separately to compare with URL without adding 'value' to deps
  useEffect(() => {
    lastEncodedRef.current = encodeRef.current(value);
  }, [value, encode]);

  const currentParam = useMemo(() => {
    const raw = router.query?.[param];
    return Array.isArray(raw) ? raw[0] : (raw ?? "");
  }, [router.query, param]);

  // Read from URL → state
  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const decodeFn = decodeRef.current;
    const onReadFn = onReadRef.current;
    const defaultFn = defaultFromUrlInvalidRef.current;

    if (typeof currentParam === "string" && currentParam.length > 0) {
      // If URL already reflects current state, skip
      // If the URL already matches current state, skip decoding and onRead
      if (lastEncodedRef.current === currentParam) {
        return;
      }
      try {
        const parsed = decodeFn(currentParam);
        isHydratingFromUrl.current = true;
        onReadFn?.(parsed);
      } catch {
        if (defaultFn) {
          isHydratingFromUrl.current = true;
          onReadFn?.(defaultFn());
        }
      } finally {
        setTimeout(() => (isHydratingFromUrl.current = false), 0);
      }
    } else if (defaultFn) {
      // Only hydrate defaults if local state is still at its default encoding.
      // This avoids a race where we set state → URL (debounced) and briefly see
      // an empty URL param that would otherwise reset state back to default.
      const defaultValue = defaultFn();
      const defaultEncoded = encodeRef.current(defaultValue);
      if (lastEncodedRef.current === "" || lastEncodedRef.current === defaultEncoded) {
        isHydratingFromUrl.current = true;
        onReadFn?.(defaultValue);
        setTimeout(() => (isHydratingFromUrl.current = false), 0);
      }
    }
    // Only re-run when URL param actually changes or router becomes ready
  }, [router.isReady, currentParam]);

  // Write state → URL (debounced)
  const debouncedReplace = useRef(
    debounce((next: string) => {
      // Merge against the latest URL search params at execution time to avoid
      // races between multiple hooks writing different params in parallel.
      try {
        const url = new URL(window.location.href);
        const sp = new URLSearchParams(url.search);
        sp.set(param, next);
        const q: Record<string, string> = {};
        sp.forEach((v, k) => {
          q[k] = v;
        });
        router.replace({ pathname: router.pathname, query: q }, undefined, { shallow });
      } catch {
        // Fallback to router.query merge if window is unavailable for any reason
        const q = { ...router.query, [param]: next } as Record<string, any>;
        router.replace({ pathname: router.pathname, query: q }, undefined, { shallow });
      }
    }, debounceMs)
  ).current;

  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    if (isHydratingFromUrl.current) {
      return;
    }

    const next = encodeRef.current(value);
    const curr = currentParam;
    if (curr === next) {
      return;
    }

    debouncedReplace(next);
  }, [router.isReady, value, currentParam, debouncedReplace]);
}
