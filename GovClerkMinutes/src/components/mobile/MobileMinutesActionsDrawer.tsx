import React from "react";
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
} from "@chakra-ui/react";
import { HiPencil, HiTrash } from "react-icons/hi2";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  minuteTitle: string;
  onRename: () => void;
  onDelete: () => void;
};

export default function MobileMinutesActionsDrawer({
  isOpen,
  onClose,
  minuteTitle,
  onRename,
  onDelete,
}: Props) {
  const handleRename = () => {
    onClose();
    onRename();
  };

  const handleDelete = () => {
    onClose();
    onDelete();
  };

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
      <DrawerOverlay />
      <DrawerContent borderTopRadius="2xl" pb={4} pt={2}>
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="md" fontWeight="semibold" pb={2}>
          {minuteTitle}
        </DrawerHeader>
        <DrawerBody px={4} pt={2}>
          <VStack spacing={2} align="stretch">
            <Button
              size="md"
              variant="ghost"
              leftIcon={<Icon as={HiPencil} boxSize={5} />}
              justifyContent="flex-start"
              h="40px"
              onClick={handleRename}
            >
              Rename
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
