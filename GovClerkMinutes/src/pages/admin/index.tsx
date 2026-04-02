import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@clerk/nextjs";
import Head from "next/head";
import {
  Box,
  Circle,
  Flex,
  Heading,
  useColorModeValue,
  Switch,
  FormControl,
  FormLabel,
  Text,
  Tooltip,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
} from "@chakra-ui/react";
import DesktopLayout from "@/components/layouts/DesktopLayout";
import AnnouncementBar, { useAnnouncementBarHeight } from "@/components/AnnouncementBar";
import TokenManagement from "@/components/admin/TokenManagement";
import CheckoutLinkGenerator from "@/components/admin/CheckoutLinkGenerator";
import LoginLinkGenerator from "@/components/admin/LoginLinkGenerator";
import AdminUploadManager from "@/components/admin/AdminUploadManager";
import WhatsappFollowupScheduler from "@/components/admin/WhatsappFollowupScheduler";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { GetServerSideProps } from "next";
import { Environment } from "@/utils/environment";
import Whatsapps from "@/components/admin/Whatsapps";
import AiActivities from "@/components/admin/AiActivities";
import whatsapp from "@/admin/whatsapp/api";
import { Template } from "@/admin/whatsapp/api/templates";

type Tool =
  | {
      kind: "checkout";
      label: "Sales / Checkout";
      props: { env: Environment };
    }
  | {
      kind: "tokens";
      label: "User Tokens";
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
      label: "Automated Follow-up Scheduler";
      props: { whatsappMessageTemplates: Template[] };
    }
  | {
      kind: "whatsapps";
      label: "WhatsApps";
      props: { whatsappMessageTemplates: Template[] };
    }
  | {
      kind: "ai-activities";
      label: "AI Activities";
    };

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (context) => {
  let toolIndex = context.query.tool ? Number(context.query.tool) : 0;
  if (isNaN(toolIndex) || toolIndex < 0) {
    toolIndex = 0;
  }

  let whatsappTemplates: Template[] = [];
  try {
    const result = await whatsapp.getTemplates({
      status: "APPROVED",
      fetchAll: true,
    });
    whatsappTemplates = result.templates;
  } catch (err) {
    console.warn(
      "Failed to fetch WhatsApp templates (META_WHATSAPP_BUSINESS_API_KEY may not be configured):",
      err
    );
  }

  return {
    props: {
      toolIndex,
      whatsappMessageTemplates: whatsappTemplates,
    },
  };
});

type Props = {
  toolIndex: number;
  whatsappMessageTemplates: Template[];
};
export default function AdminPage({
  toolIndex: initialToolIndex,
  whatsappMessageTemplates,
}: Props) {
  const { user, isSignedIn } = useUser();
  const router = useRouter();

  const [env, setEnv] = useState<Environment>("prod");
  let [toolIndex, setToolIndex] = useState(initialToolIndex);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  const announcementBarHeight = useAnnouncementBarHeight();
  const mainContainerHeight = `calc(100dvh - ${announcementBarHeight}px)`;

  useEffect(() => {
    if (isSignedIn && user && user.publicMetadata.role !== "admin") {
      router.push("/dashboard");
    }
  }, [isSignedIn, user, router]);

  useEffect(() => {
    fetch("/api/admin/token", { method: "GET" })
      .then((r) => setApiHealthy(r.status < 500))
      .catch(() => setApiHealthy(false));
  }, []);

  // Define the tools as a discriminated union array
  const tools: Tool[] = [
    { kind: "checkout", label: "Sales / Checkout", props: { env } },
    { kind: "tokens", label: "User Tokens" },
    { kind: "login", label: "Login Links" },
    { kind: "upload", label: "Upload for User" },
    {
      kind: "whatsapp",
      label: "Automated Follow-up Scheduler",
      props: { whatsappMessageTemplates },
    },
    {
      kind: "whatsapps",
      label: "WhatsApps",
      props: { whatsappMessageTemplates },
    },
    { kind: "ai-activities", label: "AI Activities" },
  ];

  // Icons for each tool kind in the sidebar
  const toolIcons: Record<Tool["kind"], string> = {
    checkout: "💰",
    tokens: "🎟️",
    login: "🔗",
    upload: "📤",
    whatsapp: "📅",
    whatsapps: "💬",
    "ai-activities": "🤖",
  };

  // Helper to render the correct tool
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
      case "ai-activities":
        return <AiActivities />;
      default:
        return null;
    }
  }

  return (
    <>
      <Head>
        <title>🛡️ GovClerk Admin Panel</title>
        <meta name="description" content="Admin management panel for GovClerkMinutes" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AnnouncementBar />

      <Flex
        w="full"
        h={mainContainerHeight}
        mt={`${announcementBarHeight}px`}
        bg={useColorModeValue("gray.50", "gray.900")}
      >
        <DesktopLayout>
          <Box maxW="1000px" mx="auto" p={4} flexGrow={1} overflowY="auto">
            <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={3}>
              <Flex alignItems="center" gap={3}>
                <Heading as="h1" size="lg" color="purple.700">
                  🛡️ GovClerk Admin Panel
                </Heading>
                <Tooltip
                  label={
                    apiHealthy === null
                      ? "Checking API…"
                      : apiHealthy
                        ? "API healthy"
                        : "API unhealthy – check server logs"
                  }
                  hasArrow
                >
                  <Circle
                    size="10px"
                    bg={apiHealthy === null ? "gray.300" : apiHealthy ? "green.400" : "red.500"}
                  />
                </Tooltip>
              </Flex>
              <Flex
                alignItems="center"
                bg="white"
                px={4}
                py={2}
                borderRadius="full"
                border="1px solid"
                borderColor="gray.200"
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
                    colorScheme="purple"
                    isChecked={env === "dev"}
                    onChange={() => setEnv(env === "dev" ? "prod" : "dev")}
                  />
                </FormControl>
              </Flex>
            </Flex>

            <Accordion
              index={toolIndex}
              onChange={(i) => {
                const idx = i as number;
                setToolIndex(idx);
                router.replace(`/admin?tool=${idx}`, undefined, { shallow: true });
              }}
              allowToggle
            >
              {tools.map((tool, i) => (
                <AccordionItem
                  key={tool.kind}
                  mb={3}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="lg"
                  overflow="hidden"
                >
                  <h2>
                    <AccordionButton
                      py={4}
                      px={5}
                      bg={toolIndex === i ? "purple.600" : "white"}
                      color={toolIndex === i ? "white" : "gray.700"}
                      _hover={{ bg: toolIndex === i ? "purple.700" : "gray.50" }}
                    >
                      <Box flex="1" textAlign="left" fontWeight="semibold" fontSize="md">
                        {toolIcons[tool.kind]} {tool.label}
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={6} pt={4} bg="white">
                    {renderTool(tool)}
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>

            <Flex justify="center" mt={4}>
              <Button
                variant="link"
                colorScheme="purple"
                onClick={() => router.push("/admin/whatsapp")}
              >
                WhatsApp Inbox
              </Button>
            </Flex>
          </Box>
        </DesktopLayout>
      </Flex>
    </>
  );
}
