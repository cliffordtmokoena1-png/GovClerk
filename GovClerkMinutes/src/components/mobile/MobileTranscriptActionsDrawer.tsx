import React from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  VStack,
  Button,
  Icon,
  useToast,
} from "@chakra-ui/react";
import { HiPencil, HiTrash, HiClipboard } from "react-icons/hi2";
import { useRouter } from "next/router";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  transcriptId: number;
  onRename: () => void;
};

export default function MobileTranscriptActionsDrawer({
  isOpen,
  onClose,
  transcriptId,
  onRename,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(transcriptId.toString());
    toast({
      title: "ID copied to clipboard",
      description: `Transcript ID ${transcriptId} has been copied`,
      status: "success",
      duration: 2000,
      isClosable: true,
    });
    onClose();
  };

  const handleDelete = async () => {
    const res = await fetch("/api/delete-transcript", {
      method: "POST",
      body: JSON.stringify({ transcriptId }),
    });
    if (!res.ok) {
      toast({
        title: "Error deleting transcript",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    router.push("/dashboard");
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
      <DrawerOverlay />
      <DrawerContent borderTopRadius="2xl" pb={4} pt={2}>
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="md" fontWeight="semibold" pb={2}>
          Actions
        </DrawerHeader>
        <DrawerBody px={4} pt={2}>
          <VStack spacing={2} align="stretch">
            <Button
              size="md"
              variant="ghost"
              leftIcon={<Icon as={HiPencil} boxSize={5} />}
              justifyContent="flex-start"
              h="40px"
              onClick={() => {
                onRename();
                onClose();
              }}
            >
              Rename
            </Button>
            <Button
              size="md"
              variant="ghost"
              leftIcon={<Icon as={HiClipboard} boxSize={5} />}
              justifyContent="flex-start"
              h="40px"
              onClick={handleCopyId}
            >
              Copy ID
            </Button>
            <Button
              size="md"
              variant="ghost"
              leftIcon={<Icon as={HiTrash} boxSize={5} />}
              justifyContent="flex-start"
              colorScheme="red"
              h="40px"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
