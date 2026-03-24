import { Divider, Heading } from "@chakra-ui/react";
import { Environment } from "@/utils/environment";
import TokenManagementForm from "@/components/admin/token/TokenManagementForm";

type Props = {};

export default function TokenManagement({}: Props) {
  return (
    <>
      <Heading size="md" mb={5} color="purple.600">
        Manage User Tokens
      </Heading>
      <Divider mb={5} />
      <TokenManagementForm />
    </>
  );
}
