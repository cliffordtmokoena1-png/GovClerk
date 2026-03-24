import { useMemo } from "react";
import { useToast } from "@chakra-ui/react";
import useSWR from "swr";

import { Template } from "@/types/Template";
import { useOrgContext } from "@/contexts/OrgContext";

const fetchTemplates = async (url: string): Promise<Template[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  const data = (await response.json()) as { templates: Template[] };
  return data.templates;
};

export function useTemplates() {
  const { orgId } = useOrgContext();

  const url = orgId ? `/api/templates?orgId=${encodeURIComponent(orgId)}` : "/api/templates";

  const { data, error, isLoading, mutate } = useSWR<Template[]>(url, fetchTemplates, {
    revalidateOnFocus: false,
  });
  const toast = useToast();

  const deleteTemplate = async (templateId: string) => {
    const response = await fetch("/api/templates/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId, orgId }),
    });

    if (!response.ok) {
      const { error: message } = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(message ?? "Failed to delete template");
    }

    await mutate();
  };

  const deleteTemplateWithToast = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete template";
      toast({
        title: "Failed to delete template",
        description: message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      throw err;
    }
  };

  const sortedTemplates = useMemo(() => {
    if (!Array.isArray(data)) {
      return [] as Template[];
    }

    const filtered = data.filter((template): template is Template => template != null);

    return filtered.slice().sort((a, b) => {
      if (a.id === "GovClerkMinutes-template") {
        return -1;
      }
      if (b.id === "GovClerkMinutes-template") {
        return 1;
      }
      if (a.isCustom === b.isCustom) {
        return 0;
      }
      return a.isCustom ? 1 : -1;
    });
  }, [data]);

  return {
    templates: sortedTemplates,
    isLoading,
    error,
    mutate,
    deleteTemplate: deleteTemplateWithToast,
  } as const;
}
