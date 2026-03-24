import { Box, Heading } from "@chakra-ui/react";
import type { Conversation } from "@/admin/whatsapp/types";
import ProspectInfoDetails from "./ProspectInfoDetails";

type Props = {
  conversation: Conversation | null;
};

export default function ProspectInfoSidebar({ conversation }: Props) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      p={{ base: 3, md: 4 }}
      borderRadius={{ base: "md", md: "lg" }}
      w="100%"
      maxW={{ base: "100%", lg: "420px" }}
      h="100dvh"
      maxH="100dvh"
      overflowY="auto"
    >
      {conversation ? (
        <>
          <Heading as="h3" size="sm" mb={3} color="gray.700">
            Contact Details
          </Heading>
          <ProspectInfoDetails conversation={conversation} />
        </>
      ) : null}
    </Box>
  );
}
