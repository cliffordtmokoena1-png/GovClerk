import { useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@clerk/nextjs";
import {
  Box,
  Flex,
  Heading,
  Switch,
  FormControl,
  FormLabel,
  Text,
  useBreakpointValue,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  VStack,
} from "@chakra-ui/react";
import TokenManagement from "@/components/admin/TokenManagement";
import CheckoutLinkGenerator from "@/components/admin/CheckoutLinkGenerator";
import LoginLinkGenerator from "@/components/admin/LoginLinkGenerator";
import AdminUploadManager from "@/components/admin/AdminUploadManager";
import WhatsappFollowupScheduler from "@/components/admin/WhatsappFollowupScheduler";
import Whatsapps from "@/components/admin/Whatsapps";
import { Template } from "@/admin/whatsapp/api/templates";
import { Environment } from "@/utils/environment";

type Tool =
  | {
      kind: "checkout";
      label: "Sales / Checkout";
      props: { env: Environment };
    }
  | {
      kind: "tokens";
      label: "User Token";
    }
  | {
      kind: "login";
      label: "Login Links";
    }
  | {
      kind: "upload";
      label: "Upload for User";
    }
  | {
      kind: "whatsapp";
      label: "WhatsApp Followup Scheduler";
      props: { whatsappMessageTemplates: Template[] };
    }
  | {
      kind: "whatsapps";
      label: "WhatsApps";
      props: { whatsappMessageTemplates: Template[] };
    };

interface AdminContentProps {
  readonly whatsappMessageTemplates: Template[];
  readonly initialToolIndex?: number;
}

export default function AdminContent({
  whatsappMessageTemplates,
  initialToolIndex = 0,
}: AdminContentProps) {
  const router = useRouter();
  const { user, isSignedIn } = useUser();

  const [env, setEnv] = useState<Environment>("prod");
  const [toolIndex, setToolIndex] = useState(initialToolIndex);

  const isMobile = useBreakpointValue({ base: true, md: false });

  const tools: Tool[] = [
    { kind: "checkout", label: "Sales / Checkout", props: { env } },
    { kind: "tokens", label: "User Token" },
    { kind: "login", label: "Login Links" },
    { kind: "upload", label: "Upload for User" },
    {
      kind: "whatsapp",
      label: "WhatsApp Followup Scheduler",
      props: { whatsappMessageTemplates },
    },
    {
      kind: "whatsapps",
      label: "WhatsApps",
      props: { whatsappMessageTemplates },
    },
  ];

  function renderTool(tool: Tool) {
    switch (tool.kind) {
      case "checkout":
        return <CheckoutLinkGenerator {...tool.props} />;
      case "tokens":
        return <TokenManagement />;
      case "login":
        return <LoginLinkGenerator />;
      case "upload":
        return <AdminUploadManager />;
      case "whatsapp":
        return <WhatsappFollowupScheduler {...tool.props} />;
      case "whatsapps":
        return <Whatsapps {...tool.props} />;
      default:
        return null;
    }
  }

  // Check admin access
  if (isSignedIn && user && user.publicMetadata.role !== "admin") {
    return (
      <Box p={6}>
        <Text color="red.500">Access denied. Admin privileges required.</Text>
      </Box>
    );
  }

  return (
    <Box w="100%" p={{ base: 2, md: 8 }} flexGrow={1} overflowY="auto">
      <Flex
        justifyContent="space-between"
        alignItems={{ base: "flex-start", md: "center" }}
        mb={6}
        direction={{ base: "column", md: "row" }}
        gap={2}
      >
        <Heading as="h1" size="lg" color="purple.700">
          ⚙️ Admin Panel
        </Heading>
        <Flex
          alignItems="center"
          bg="white"
          p={2}
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="gray.200"
          mt={{ base: 2, md: 0 }}
        >
          <FormControl display="flex" alignItems="center" mb={0}>
            <FormLabel htmlFor="dev-mode" mb={0} mr={2}>
              <Text
                fontWeight="medium"
                fontSize="sm"
                color={env === "dev" ? "orange.500" : "green.600"}
              >
                Current Environment: {env === "dev" ? "Development" : "Production"}
              </Text>
            </FormLabel>
            <Switch
              id="dev-mode"
              colorScheme="orange"
              isChecked={env === "dev"}
              onChange={() => setEnv(env === "dev" ? "prod" : "dev")}
            />
          </FormControl>
        </Flex>
      </Flex>

      {isMobile ? (
        <Accordion allowToggle allowMultiple defaultIndex={[0]}>
          {[
            ...tools.map((tool, i) => (
              <AccordionItem key={tool.label} border="none">
                <AccordionButton
                  px={4}
                  py={3}
                  _expanded={{ bg: "purple.50", color: "purple.700" }}
                  onClick={() => {
                    router.replace(`/a/admin?tool=${i}`, undefined, { shallow: true });
                    setToolIndex(i);
                  }}
                >
                  <Box flex="1" textAlign="left" fontWeight="semibold">
                    {tool.label}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={2} pb={4} overflow="visible">
                  {renderTool(tool)}
                </AccordionPanel>
              </AccordionItem>
            )),
            <Button
              key="last"
              variant="link"
              colorScheme="purple"
              onClick={() => router.push("/admin/whatsapp")}
            >
              Whatsapp Inbox
            </Button>,
          ]}
        </Accordion>
      ) : (
        <Flex direction="row" gap={8} overflow="visible">
          <VStack
            align="stretch"
            minW="220px"
            bg="white"
            borderRadius="lg"
            boxShadow="sm"
            p={3}
            spacing={2}
          >
            {tools.map((tool, i) => (
              <Button
                key={tool.label}
                variant={toolIndex === i ? "solid" : "ghost"}
                colorScheme={toolIndex === i ? "purple" : "gray"}
                onClick={() => {
                  router.replace(`/a/admin?tool=${i}`, undefined, { shallow: true });
                  setToolIndex(i);
                }}
                justifyContent="flex-start"
                fontWeight="medium"
                borderRadius="md"
                size="lg"
              >
                {tool.label}
              </Button>
            ))}
          </VStack>
          <Box
            flex={1}
            minW={0}
            bg="white"
            borderRadius="lg"
            boxShadow="sm"
            p={6}
            overflow="visible"
          >
            {renderTool(tools[toolIndex])}
          </Box>
        </Flex>
      )}
    </Box>
  );
}
