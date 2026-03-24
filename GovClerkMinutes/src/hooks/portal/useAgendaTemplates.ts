import { useCallback } from "react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";

import type {
  AgendaTemplate,
  CreateAgendaTemplateRequest,
  CreateAgendaTemplateResponse,
  AgendaTemplatesResponse,
  LoadTemplateRequest,
  LoadTemplateResponse,
  GeneratedAgendaItem,
} from "@/types/agenda";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { useOrgContext } from "@/contexts/OrgContext";

interface TemplatesResponse {
  templates: AgendaTemplate[];
}

const fetcher = async (url: string): Promise<TemplatesResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch agenda templates");
  }
  return response.json();
};

export function useAgendaTemplates() {
  const { orgId } = useOrgContext();

  const url = orgId ? `/api/portal/agenda-templates?orgId=${orgId}` : null;

  const { data, error, isLoading, mutate } = useSWR<TemplatesResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  const templates = data?.templates ?? [];

  const fetchTemplates = useCallback(async (): Promise<AgendaTemplate[]> => {
    if (!orgId) {
      throw new Error("Organization ID is required");
    }

    const response = await fetch(`/api/portal/agenda-templates?orgId=${orgId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || "Failed to fetch templates";
      toast.error(message);
      throw new Error(message);
    }

    const result: TemplatesResponse = await response.json();
    return result.templates;
  }, [orgId]);

  const saveTemplate = useCallback(
    async (
      input: CreateAgendaTemplateRequest & {
        meetingId?: number;
        agendaItems?: MgAgendaItemWithRelations[];
      }
    ): Promise<AgendaTemplate> => {
      if (!orgId) {
        throw new Error("Organization ID is required");
      }

      const response = await fetch("/api/portal/agenda-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to save template";
        toast.error(message);
        throw new Error(message);
      }

      const result: CreateAgendaTemplateResponse = await response.json();
      await mutate();

      toast.success(`"${input.name}" has been saved as a template.`);

      return result.template;
    },
    [orgId, mutate]
  );

  const loadTemplate = useCallback(
    async (meetingId: number, templateId: number): Promise<GeneratedAgendaItem[]> => {
      if (!orgId) {
        throw new Error("Organization ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/load-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to load template";
        toast.error(message);
        throw new Error(message);
      }

      const result: LoadTemplateResponse = await response.json();

      // Also mutate the agenda cache to refresh the agenda items
      if (orgId) {
        await globalMutate(`/api/portal/meetings/${meetingId}/agenda?orgId=${orgId}`);
      }

      toast.success("Template has been loaded into the agenda.");

      return result.items;
    },
    [orgId]
  );

  const deleteTemplate = useCallback(
    async (templateId: number): Promise<void> => {
      if (!orgId) {
        throw new Error("Organization ID is required");
      }

      const response = await fetch(`/api/portal/agenda-templates/${templateId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to delete template";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();

      toast.success("Template deleted");
    },
    [orgId, mutate]
  );

  return {
    templates,
    isLoading,
    error,
    mutate,
    fetchTemplates,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
  } as const;
}
