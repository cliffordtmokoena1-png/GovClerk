import { useState } from "react";
import { useToast } from "@chakra-ui/react";
import useSWR from "swr";
import { saveAs } from "file-saver";
import { useConvertDocument } from "@/hooks/useConvertDocument";
import { isDev } from "@/utils/dev";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { Template } from "@/types/Template";
import { safeCapture } from "@/utils/safePosthog";

export function useTemplateDownload() {
  const toast = useToast();
  const { convert, isLoading } = useConvertDocument();
  const { data: customerDetails, isLoading: isLoadingCustomer } =
    useSWR<ApiGetCustomerDetailsResponse>("/api/get-customer-details", async (uri: string) => {
      const response = await fetch(uri, { method: "POST" });
      return await response.json();
    });
  const [showPaywall, setShowPaywall] = useState(false);

  const isSubscribed =
    customerDetails?.subscriptionStatus === "active" ||
    customerDetails?.subscriptionStatus === "cancel_at_period_end";

  const canDownload = true;

  const downloadTemplate = async (template: Template, onSuccess?: () => void) => {
    if (!canDownload) {
      setShowPaywall(true);
      safeCapture("template_paywall_shown", {
        template_id: template.id,
        template_name: template.name,
        template_category: template.category,
      });
      return;
    }

    try {
      safeCapture("template_download_started", {
        template_id: template.id,
        template_name: template.name,
        template_category: template.category,
      });

      const blob = await convert({
        input: new Blob([template.content], { type: "text/markdown" }),
        outputType: "docx",
        inputType: "gfm",
      });

      if (blob) {
        saveAs(blob, `${template.name.replace(/\s+/g, "_")}_Template.docx`);

        safeCapture("template_download_completed", {
          template_id: template.id,
          template_name: template.name,
          template_category: template.category,
        });

        toast({
          title: "Template downloaded",
          description: "Your template has been downloaded successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        onSuccess?.();
      }
    } catch (error) {
      safeCapture("template_download_failed", {
        template_id: template.id,
        template_name: template.name,
        template_category: template.category,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download template",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return {
    downloadTemplate,
    isLoading: isLoading || isLoadingCustomer,
    canDownload,
    showPaywall,
  };
}
