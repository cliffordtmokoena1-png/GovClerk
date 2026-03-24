import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  Heading,
} from "@chakra-ui/react";
import type { Conversation } from "@/admin/whatsapp/types";
import ProspectInfoDetails from "@/components/admin/whatsapp/ProspectInfoDetails";

type Props = {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function ProspectInfoDrawer({ conversation, isOpen, onClose }: Props) {
  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="sm">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <Heading as="h3" size="sm">
            Contact Details
          </Heading>
        </DrawerHeader>
        <DrawerBody>
          {conversation ? <ProspectInfoDetails conversation={conversation} /> : null}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
