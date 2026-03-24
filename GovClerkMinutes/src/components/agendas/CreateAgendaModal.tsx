import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  Text,
  FormHelperText,
} from "@chakra-ui/react";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const MAX_CHARS = 20000;

type CreateAgendaModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agendaId: string) => void;
}>;

export default function CreateAgendaModal({ isOpen, onClose, onSuccess }: CreateAgendaModalProps) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = () => {
    if (isCreating) return;
    setTitle("");
    setSourceText("");
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedText = sourceText.trim();
    if (!trimmedText) {
      toast({ title: "Please provide meeting context", status: "warning", duration: 3000 });
      return;
    }

    setIsCreating(true);

    try {
      const token = await getToken();

      const res = await fetch("/api/agendas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceText: trimmedText,
          title: title.trim() || null,
        }),
      });

      if (!res.ok) {
        let message = "Please try again";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      const { id } = await res.json();

      toast({ title: "Agenda created successfully", status: "success", duration: 3000 });

      onSuccess(String(id));
      handleClose();

      // Trigger generation in the background — creation already succeeded.
      fetch(`/api/agendas/${id}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => {
        console.error("[CreateAgendaModal] background generation failed:", err);
      });
    } catch (error) {
      console.error("[CreateAgendaModal] create failed:", error);
      toast({
        title: "Failed to create agenda",
        description: error instanceof Error ? error.message : "Please try again",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const charCount = sourceText.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create New Agenda</ModalHeader>
        <ModalCloseButton isDisabled={isCreating} />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Agenda Title (Optional)</FormLabel>
              <Input
                placeholder="e.g., Monthly Board Meeting"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
              />
            </FormControl>

            <FormControl isRequired isInvalid={isOverLimit}>
              <FormLabel>Meeting Context</FormLabel>
              <Textarea
                placeholder="Paste meeting notes, topics to discuss, or any context for the agenda..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={10}
                resize="vertical"
              />
              <FormHelperText>
                <Text color={isOverLimit ? "red.500" : "gray.500"}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
                </Text>
              </FormHelperText>
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} isDisabled={isCreating}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isCreating}
            loadingText="Creating..."
            isDisabled={!sourceText.trim() || isOverLimit}
          >
            Create Agenda
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
