import { Box } from "@chakra-ui/react";
import type { Conversation } from "@/admin/whatsapp/types";
import ProspectInfoDetails from "./ProspectInfoDetails";

type Props = {
  conversation: Conversation;
  hide?: boolean;
};

export default function ProspectInfo({ conversation, hide }: Props) {
  return (
    <Box
      top="100px"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      p={{ base: 3, md: 4 }}
      borderRadius={{ base: "md", md: "lg" }}
      w="100%"
      maxW={{ base: "100%", lg: "600px" }}
      minW={{ base: "auto", lg: "320px" }}
      display={hide ? "none" : "block"}
      alignSelf="end"
    >
      {conversation && <ProspectInfoDetails conversation={conversation} />}
    </Box>
  );
}
