import { useCallback } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  PortalSettings,
  PortalSettingsListResponse,
  CreatePortalSettingsRequest,
  UpdatePortalSettingsRequest,
} from "@/types/portal";
import { useOrgContext } from "@/contexts/OrgContext";

const fetcher = async (url: string): Promise<PortalSettings | null> => {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error("Failed to fetch portal settings");
  }
  const data = (await response.json()) as PortalSettingsListResponse;
  return data.settings;
};

export function usePortalSettings() {
  const { orgId } = useOrgContext();

  const url = orgId ? `/api/portal/settings?orgId=${encodeURIComponent(orgId)}` : null;

  const { data, error, isLoading, mutate } = useSWR<PortalSettings | null>(url, fetcher, {
    revalidateOnFocus: false,
  });

  const createSettings = useCallback(
    async (request: CreatePortalSettingsRequest): Promise<PortalSettings> => {
      const response = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to create portal settings";
        toast.error(message);
        throw new Error(message);
      }

      const result = await response.json();
      await mutate();
      toast.success("Portal created");
      return result.settings;
    },
    [orgId, mutate]
  );

  const updateSettings = useCallback(
    async (id: number, request: UpdatePortalSettingsRequest): Promise<PortalSettings> => {
      const response = await fetch(`/api/portal/settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to update portal settings";
        toast.error(message);
        throw new Error(message);
      }

      const result = await response.json();
      await mutate();
      toast.success("Settings saved");
      return result.settings;
    },
    [orgId, mutate]
  );

  const checkSlugAvailability = useCallback(
    async (slug: string): Promise<boolean> => {
      const params = new URLSearchParams({ slug });
      if (orgId) {
        params.set("orgId", orgId);
      }
      const response = await fetch(`/api/portal/settings/check-slug?${params.toString()}`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.available;
    },
    [orgId]
  );

  return {
    settings: data ?? null,
    isLoading,
    error,
    mutate,
    createSettings,
    updateSettings,
    checkSlugAvailability,
  } as const;
}
