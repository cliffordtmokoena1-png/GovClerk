import { useState } from "react";
import { Checkbox, Heading, Spinner, Stack, Text, useToast } from "@chakra-ui/react";
import { useSettings } from "@/hooks/useSettings";

type Props = {};

export default function GeneralSettings({}: Props) {
  const { isLoading, settings, setSetting } = useSettings();
  const toast = useToast();

  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (next: boolean) => {
    setIsSaving(true);

    try {
      await setSetting("send-email-when-minutes-done", next);
    } catch (e) {
      toast({
        title: "Unable to save setting",
        description: "Please try again in a moment.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack spacing={4} w="full" maxW="600px" mx="auto" p={4}>
      <Heading size="lg">General settings</Heading>
      <Text color="gray.600">Control basic preferences for your account.</Text>
      {isLoading ? (
        <Stack direction="row" align="center" spacing={2}>
          <Spinner size="sm" />
          <Text color="gray.500">Loading your settings…</Text>
        </Stack>
      ) : (
        <Checkbox
          isChecked={Boolean(settings?.["send-email-when-minutes-done"])}
          onChange={(e) => handleToggle(e.target.checked)}
          isDisabled={isSaving}
          colorScheme="blue"
        >
          Send email when minutes are done
        </Checkbox>
      )}
    </Stack>
  );
}
