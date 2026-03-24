import { BusinessWhatsappNumber } from "@/admin/whatsapp/api/consts";
import { safeCapture } from "@/utils/safePosthog";
import { Box, Button, Icon } from "@chakra-ui/react";
import { FaWhatsapp } from "react-icons/fa";

type Props = {
  phone: BusinessWhatsappNumber;
  message: string;
};

export default function WhatsappCta({ phone, message }: Props) {
  const link = `https://wa.me/+${phone}?text=${encodeURIComponent(message)}`;

  return (
    <Box textAlign="center">
      <a href={link} target="_blank" rel="noopener noreferrer">
        <Button
          colorScheme="whatsapp"
          leftIcon={<Icon as={FaWhatsapp} boxSize={8} />}
          size="lg"
          variant="solid"
          onClick={() => {
            safeCapture("whatsapp_cta_clicked", { message });
          }}
        >
          Send us a message
        </Button>
      </a>
    </Box>
  );
}
