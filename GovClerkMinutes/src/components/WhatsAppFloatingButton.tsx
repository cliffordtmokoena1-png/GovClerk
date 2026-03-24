import { Box, IconButton, Tooltip } from "@chakra-ui/react";
import { FaWhatsapp } from "react-icons/fa";
import { openWhatsAppChat } from "@/utils/whatsapp";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { getPrettyPlanName } from "@/utils/price";

const DEFAULT_MESSAGE = "Hi, I need help with GovClerk.";

const postFetcher = (url: string) => fetch(url, { method: "POST" }).then((res) => res.json());

function buildSupportMessage(email: string | undefined, planName: string | undefined): string {
  const parts = [DEFAULT_MESSAGE];
  if (email) parts.push(`My email: ${email}`);
  if (planName) parts.push(`Plan: ${planName}`);
  return parts.join("\n");
}

export default function WhatsAppFloatingButton() {
  const { user } = useUser();
  const { data: customerDetails } = useSWR<ApiGetCustomerDetailsResponse>(
    user ? "/api/get-customer-details" : null,
    postFetcher
  );

  const handleClick = () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    const planName = customerDetails?.planName
      ? getPrettyPlanName(customerDetails.planName)
      : undefined;
    openWhatsAppChat(buildSupportMessage(email, planName), "floating_button");
  };

  return (
    <Box
      position="fixed"
      bottom={{ base: "80px", md: "24px" }}
      right={{ base: "16px", md: "24px" }}
      zIndex={1000}
    >
      <Tooltip label="Chat with us on WhatsApp" placement="left" hasArrow>
        <IconButton
          aria-label="Chat with us on WhatsApp"
          icon={<FaWhatsapp size={28} />}
          onClick={handleClick}
          colorScheme="whatsapp"
          borderRadius="full"
          size={{ base: "md", md: "lg" }}
          boxShadow="xl"
          _hover={{ transform: "scale(1.1)", boxShadow: "2xl" }}
          transition="all 0.2s"
        />
      </Tooltip>
    </Box>
  );
}
