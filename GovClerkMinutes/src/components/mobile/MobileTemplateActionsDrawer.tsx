import React, { useRef } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerCloseButton,
  Button,
  VStack,
  Icon,
  Text,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import { HiTrash } from "react-icons/hi2";
import { Template } from "@/types/Template";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  onDelete: () => void;
};

export default function MobileTemplateActionsDrawer({
  isOpen,
  onClose,
  template,
  onDelete,
}: Props) {
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null!);

  const handleDelete = () => {
    onConfirmClose();
    onClose();
    onDelete();
  };

  const handleRequestDelete = () => {
    onConfirmOpen();
  };

  const handleCancel = () => {
    onConfirmClose();
  };

  return (
    <>
      <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
        <DrawerOverlay />
        <DrawerContent borderTopRadius="2xl" pb={4} pt={2}>
          <DrawerCloseButton top={6} right={6} size="sm" />
          <DrawerHeader textAlign="center" fontSize="md" fontWeight="semibold" pb={2}>
            {template ? template.name : "Template Actions"}
          </DrawerHeader>
          <DrawerBody px={4} pt={2}>
            <VStack spacing={2} align="stretch">
              <Button
                size="md"
                variant="ghost"
                leftIcon={<Icon as={HiTrash} boxSize={5} />}
                justifyContent="flex-start"
                colorScheme="red"
                h="40px"
                onClick={handleRequestDelete}
              >
                Delete
              </Button>
              {template?.description && (
                <Text fontSize="xs" color="gray.500" textAlign="center" px={2}>
                  This template was generated from your samples. Deleting it cannot be undone.
                </Text>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        isOpen={isConfirmOpen}
        leastDestructiveRef={cancelRef}
        onClose={handleCancel}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete template
            </AlertDialogHeader>
            <AlertDialogBody>
              {`Are you sure you want to delete "${template?.name ?? "this template"}"? This action cannot be undone.`}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={handleCancel} variant="ghost">
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
