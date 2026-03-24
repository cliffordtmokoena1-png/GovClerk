import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { safeCapture } from "@/utils/safePosthog";
import posthog from "posthog-js";

type RenameTranscriptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transcriptId: number;
};

const RenameTranscriptModal = ({
  isOpen,
  onClose,
  onSuccess,
  transcriptId,
}: RenameTranscriptModalProps) => {
  const [newTitle, setNewTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // Reset input when the modal opens or when switching transcript target
  useEffect(() => {
    if (isOpen) {
      setNewTitle("");
    }
  }, [isOpen, transcriptId]);

  const handleSubmit = async () => {
    if (!newTitle.trim()) {
      toast({
        title: "Please enter a title",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const posthog_session_id = posthog.get_session_id();

      const response = await fetch("/api/rename-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-POSTHOG-SESSION-ID": posthog_session_id,
        },
        body: JSON.stringify({
          transcriptId,
          title: newTitle.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename transcript");
      }

      safeCapture("transcript_renamed", {
        transcript_id: transcriptId,
        $session_id: posthog_session_id,
      });

      toast({
        title: "Transcript renamed",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error renaming transcript:", error);
      toast({
        title: "Error",
        description: "Failed to rename transcript. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Rename Transcript</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>New Title</FormLabel>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new title"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="messenger"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="Renaming..."
          >
            Rename
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RenameTranscriptModal;
