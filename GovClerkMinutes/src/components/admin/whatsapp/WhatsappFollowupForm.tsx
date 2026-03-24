import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Select,
  Stack,
  useToast,
  RadioGroup,
  Radio,
  HStack,
} from "@chakra-ui/react";
import Composer from "@/components/admin/whatsapp/Composer";
import {
  extractVariables,
  getConversationActiveStatus,
  normalizeWhatsappId,
  scheduleWhatsapp,
} from "@/admin/whatsapp/utils";
import { Conversation, SchedulerMode } from "@/admin/whatsapp/types";
import type { Template } from "@/admin/whatsapp/api/templates";
import { HUBSPOT_OWNER_IDS } from "@/crm/hubspot/consts";
import { WHATSAPP_BUSINESS_PHONE_TO_ID } from "@/admin/whatsapp/api/consts";
import DateTimeField from "./DateTimeField";
import PhoneInputWithLookup from "./PhoneInputWithLookup";
import TemplateVariablesEditor from "./TemplateVariablesEditor";
import OptionsGroup from "./OptionsGroup";
import { useContactLookup } from "../../../admin/whatsapp/hooks/useContactLookup";

type Props = {
  whatsappMessageTemplates: Template[];
  conversation?: Conversation;
  defaultTemplateId?: string;
  defaultDate?: Date;
  // callbacks (optional for embedding contexts)
  onScheduled?: (ok: true) => void;
};

export default function WhatsappFollowupForm({
  whatsappMessageTemplates,
  conversation,
  defaultTemplateId,
  defaultDate = new Date(),
  onScheduled,
}: Props) {
  const toast = useToast();

  let initialMode: SchedulerMode = "template";
  if (conversation) {
    initialMode =
      getConversationActiveStatus(conversation).status === "active" ? "freeform" : "template";
  }

  const [scheduledAt, setScheduledAt] = useState<Date>(defaultDate);
  const source = conversation?.source ?? "whatsapp";
  const [templateId, setTemplateId] = useState<string>(
    defaultTemplateId || (source === "wati" ? undefined : whatsappMessageTemplates[0]?.id) || ""
  );
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<SchedulerMode>(initialMode);
  const [freeformText, setFreeformText] = useState("");
  const [makeHubspotTask, setMakeHubspotTask] = useState(false);
  const [cancelOnReply, setCancelOnReply] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const initialPhone = conversation?.whatsappId;
  const initialName = conversation?.leadName;

  const phoneOptions = useMemo(() => Object.keys(WHATSAPP_BUSINESS_PHONE_TO_ID || {}), []);

  const initialBusinessWhatsappId = useMemo(() => {
    if (source === "wati") {
      return "";
    }
    return conversation?.businessWhatsappId || phoneOptions[0] || "";
  }, [source, conversation?.businessWhatsappId, phoneOptions]);

  const [businessWhatsappId, setBusinessWhatsappId] = useState<string>(initialBusinessWhatsappId);

  const {
    phone,
    onChange: setPhoneNumber,
    loading: phoneLoading,
    contact,
  } = useContactLookup(initialPhone);

  const selectedTemplate = useMemo(
    () =>
      source === "wati" ? undefined : whatsappMessageTemplates.find((t) => t.id === templateId),
    [whatsappMessageTemplates, templateId, source]
  );

  const selectedTemplateBody = useMemo(() => {
    if (!selectedTemplate) {
      return "";
    }
    if ((selectedTemplate as any).bodyOriginal) {
      return (selectedTemplate as any).bodyOriginal as string; // Wati
    }
    if ((selectedTemplate as any).components) {
      const bodyComp = (selectedTemplate as any).components.find((c: any) => c.type === "BODY");
      if (bodyComp && typeof bodyComp.text === "string") {
        return bodyComp.text as string; // Cloud API
      }
    }
    return "";
  }, [selectedTemplate]);

  // Prefill template variables when template or contact changes
  useEffect(() => {
    const vars = extractVariables(selectedTemplateBody || "");
    const initial: Record<string, string> = {};
    vars.forEach((v) => {
      const fromContact =
        (contact && typeof contact[v] === "string" ? (contact[v] as string) : "") || "";

      if (v === "name" && contact?.name) {
        initial[v] = contact.name;
      } else if (v === "name" && !contact?.name && initialName) {
        initial[v] = initialName;
      } else if (v === "sdr_name") {
        initial[v] = HUBSPOT_OWNER_IDS.CLIFF_MOKOENA.firstname;
      } else {
        initial[v] = templateVariables[v] ?? fromContact;
      }
    });

    setTemplateVariables((prev) => {
      const updated = { ...prev, ...initial };
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateBody, contact]);

  const onVarChange = (k: string, v: string) => {
    setTemplateVariables((prev) => ({ ...prev, [k]: v }));
  };

  const canSubmit = useMemo(() => {
    if (!scheduledAt || !phone || !phone.trim()) {
      return false;
    }
    if (source !== "wati" && !businessWhatsappId) {
      return false;
    }
    if (mode === "template") {
      return Boolean(templateId);
    }
    return freeformText.trim().length > 0;
  }, [scheduledAt, phone, templateId, mode, freeformText, source, businessWhatsappId]);

  const handleSubmit = async () => {
    if (!canSubmit || !selectedTemplate || !phone) {
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "template") {
        const templateName =
          (selectedTemplate as any).elementName || (selectedTemplate as any).name || "";
        const language = source === "whatsapp" ? (selectedTemplate as any).language || "en_US" : "";
        await scheduleWhatsapp({
          mode,
          sendAt: scheduledAt.toISOString(),
          whatsappId: normalizeWhatsappId(phone),
          businessWhatsappId,
          templateBody: selectedTemplateBody,
          templateName,
          templateVariables: JSON.stringify(templateVariables),
          makeHubspotTask,
          cancelOnReply,
          source,
          language,
        });
      } else {
        await scheduleWhatsapp({
          mode,
          sendAt: scheduledAt.toISOString(),
          whatsappId: normalizeWhatsappId(phone),
          businessWhatsappId,
          makeHubspotTask,
          cancelOnReply,
          text: freeformText,
          source: conversation?.source || "whatsapp",
        });
      }

      toast({
        title: "Message scheduled!",
        description: `${phone} @ ${scheduledAt.toLocaleString()}`,
        status: "success",
        duration: 4000,
        isClosable: true,
        position: "top-right",
      });

      onScheduled?.(true);
    } catch (e) {
      console.error(e);
      toast({
        title: "Unable to schedule message.",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top-right",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box borderWidth={1} borderRadius="lg" boxShadow="sm" p={6} bg="white">
      <Stack spacing={4}>
        <RadioGroup value={mode} onChange={(v) => setMode(v as any)}>
          <HStack spacing={4}>
            <Radio value="template">Template message</Radio>
            <Radio value="freeform">Freeform</Radio>
          </HStack>
        </RadioGroup>
        <DateTimeField value={scheduledAt} onChange={setScheduledAt} isRequired />

        <PhoneInputWithLookup
          value={phone ?? ""}
          onChange={setPhoneNumber}
          loading={phoneLoading}
          contact={contact}
          isRequired
        />

        <FormControl id="business-number" isRequired={source !== "wati"}>
          <FormLabel>Business number</FormLabel>
          <Select
            value={businessWhatsappId}
            onChange={(e) => setBusinessWhatsappId(e.target.value)}
          >
            {source === "wati" ? (
              <option value="">Wati-managed</option>
            ) : (
              phoneOptions.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))
            )}
          </Select>
        </FormControl>

        {mode === "template" ? (
          <>
            <FormControl id="template" isRequired>
              <FormLabel>Template message</FormLabel>
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {source === "wati"
                  ? null
                  : whatsappMessageTemplates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
              </Select>
            </FormControl>

            {selectedTemplate && (
              <TemplateVariablesEditor
                template={selectedTemplate as any}
                variables={templateVariables}
                onVariableChange={onVarChange}
              />
            )}
          </>
        ) : (
          <FormControl id="freeform" isRequired>
            <FormLabel>Message</FormLabel>
            <Composer
              conversation={conversation}
              onOptimisticMessage={() => {}}
              value={freeformText}
              onChangeText={setFreeformText}
              hideSendButton
            />
          </FormControl>
        )}

        <OptionsGroup
          makeHubspotTask={makeHubspotTask}
          cancelOnReply={cancelOnReply}
          onChange={({ makeHubspotTask: newMakeHubspotTask, cancelOnReply: newCancelOnReply }) => {
            setMakeHubspotTask(newMakeHubspotTask);
            setCancelOnReply(newCancelOnReply);
          }}
        />

        <Button
          colorScheme="whatsapp"
          onClick={handleSubmit}
          mt={2}
          width="full"
          disabled={!canSubmit}
          isLoading={submitting}
        >
          Schedule message
        </Button>
      </Stack>
    </Box>
  );
}
