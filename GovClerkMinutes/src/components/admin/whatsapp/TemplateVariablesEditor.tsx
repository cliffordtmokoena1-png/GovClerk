import React from "react";
import { Box, Input, Stack, Text } from "@chakra-ui/react";
import type { Template } from "@/admin/whatsapp/api/templates";
import { extractVariables } from "@/admin/whatsapp/utils";

// The component now supports two template shapes:
// 1. Wati MessageTemplate (has bodyOriginal)
// 2. WhatsApp Cloud Template (Template) where body text is inside components[] with type === 'BODY'
type Props = {
  template: Template;
  variables: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
};

export default function TemplateVariablesEditor({ template, variables, onVariableChange }: Props) {
  // Derive the body text depending on template shape.
  const body: string = ((): string => {
    // Wati template
    if ((template as any).bodyOriginal) {
      return (template as any).bodyOriginal as string;
    }
    // WhatsApp Cloud template
    if ((template as any).components && Array.isArray((template as any).components)) {
      const bodyComp = (template as any).components.find((c: any) => c.type === "BODY");
      if (bodyComp && typeof bodyComp.text === "string") {
        return bodyComp.text as string;
      }
    }
    return "";
  })();

  const renderPreview = (templateBody: string) => {
    return templateBody.split(/({{[^}]+}})/g).map((part, idx) => {
      const match = part.match(/{{\s*(\w+)\s*}}/);
      if (match) {
        const variable = match[1];
        const value = variables[variable];
        return (
          <Text
            key={`${variable}-${idx}`}
            as="span"
            px={0.5}
            py={0.5}
            borderRadius="md"
            backgroundColor={value ? "purple.100" : "gray.200"}
            fontWeight="medium"
            fontFamily="monospace"
          >
            {value || `{{${variable}}}`}
          </Text>
        );
      }
      return (
        <Text key={`txt-${idx}`} as="span" fontFamily="monospace">
          {part}
        </Text>
      );
    });
  };

  const templateVariables = extractVariables(body);

  if (templateVariables.length === 0) {
    return (
      <Box p={3} bg="white" border="1px dashed" borderColor="gray.300" borderRadius="md">
        <Text fontSize="sm">{body}</Text>
      </Box>
    );
  }

  return (
    <Box mt={4} p={3} bg="yellow.50" borderRadius="md" border="1px solid" borderColor="gray.200">
      <Stack spacing={2}>
        {templateVariables.map((v) => (
          <React.Fragment key={v}>
            <Text fontSize="sm" fontWeight="medium">
              {`{{${v}}}`}
            </Text>
            <Input
              bg="white"
              size="sm"
              value={variables[v] || ""}
              onChange={(e) => onVariableChange(v, e.target.value)}
              placeholder={`Enter ${v}`}
            />
          </React.Fragment>
        ))}

        <Box p={3} bg="white" border="1px dashed" borderColor="gray.300" borderRadius="md">
          <Text fontSize="sm">{renderPreview(body)}</Text>
        </Box>
      </Stack>
    </Box>
  );
}
