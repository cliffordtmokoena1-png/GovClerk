import { Button } from "@chakra-ui/react";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = {
  variant: "solid" | "outline" | "ghost";
};

export default function ManagePaymentButton({ variant }: Props) {
  return (
    <Button
      variant={variant}
      colorScheme="gray"
      size="sm"
      onClick={() => {
        openWhatsAppChat(
          "Hi, I would like to manage my payment settings.",
          "manage_payment_button"
        );
      }}
    >
      Manage payment settings
    </Button>
  );
}
