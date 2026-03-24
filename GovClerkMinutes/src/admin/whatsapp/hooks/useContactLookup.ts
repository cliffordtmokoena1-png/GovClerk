import { useEffect, useRef, useState } from "react";
import { debounce } from "@/utils/debounce";
import type { ContactProperties } from "@/admin/whatsapp/types";
import { normalizeWhatsappId } from "@/admin/whatsapp/utils";

export type UseContactLookupResult = {
  phone?: string;
  contact?: ContactProperties;
  onChange: (newPhone: string) => void;
  loading: boolean;
  notFound: boolean;
};

export function useContactLookup(initialPhone?: string): UseContactLookupResult {
  const [phone, setPhone] = useState(initialPhone ?? undefined);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [contact, setContact] = useState<ContactProperties>();

  // Debounced fetch logic for phone lookup
  const debouncedFetchRef = useRef(
    debounce(async (number: string) => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/get-contact", {
          method: "POST",
          body: JSON.stringify({
            whatsappId: normalizeWhatsappId(number),
          }),
        });
        if (response.status === 404) {
          setContact(undefined);
          setNotFound(true);
        }
        if (!response.ok) {
          return;
        }
        const contactProperties = await response.json();
        setContact({ ...contactProperties });
      } finally {
        setLoading(false);
      }
    }, 1000)
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    const current = debouncedFetchRef.current;
    return () => {
      current.cancel();
    };
  }, []);

  // If an initialPhone is provided, kick off a single initial fetch.
  // (Do NOT call during render.)
  useEffect(() => {
    if (initialPhone) {
      debouncedFetchRef.current(initialPhone);
    }
  }, [initialPhone]);

  // Fetch whenever the controlled `phone` value changes (user typing, etc.)
  useEffect(() => {
    if (!phone) {
      return;
    }
    debouncedFetchRef.current(phone);
  }, [phone]);

  const onChange = (newPhone: string) => {
    setPhone(newPhone);
    setContact(undefined); // clear prior match while typing
  };

  return { phone, onChange, loading, notFound, contact };
}
