import React, { useState } from "react";
import {
  VStack,
  Heading,
  Text,
  Textarea,
  Button,
  Input,
  useToast,
  Flex,
  Box,
  Icon,
  Badge,
} from "@chakra-ui/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { FaMagic, FaCalendarAlt, FaLightbulb, FaListUl } from "react-icons/fa";
import { safeCapture } from "@/utils/safePosthog";

const MAX_CHARS = 20000;

const TIPS = [
  { icon: FaLightbulb, text: "Include meeting objectives and key topics" },
  { icon: FaListUl, text: "Add attendees and their roles for context" },
  { icon: FaCalendarAlt, text: "Mention time constraints or deadlines" },
];

export default function AgendaHomePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    const trimmedText = sourceText.trim();
    if (!trimmedText) {
      toast({ title: "Please provide meeting context", status: "warning", duration: 3000 });
      return;
    }

    setIsCreating(true);

    try {
      const token = await getToken();

      const res = await fetch("/api/agendas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceText: trimmedText,
          title: title.trim() || null,
        }),
      });

      if (!res.ok) {
        let message = "Please try again";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      const { id, seriesId } = await res.json();

      safeCapture("agenda_created", { agenda_id: id, series_id: seriesId });

      // Reset loading state before navigating so it doesn't persist if navigation is cancelled.
      setIsCreating(false);

      // Navigate immediately — generation runs in the background.
      router.push(`/agendas/${id}`);

      fetch(`/api/agendas/${id}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => {
        console.error("[AgendaHomePage] background generation failed:", err);
      });
    } catch (error) {
      console.error("[AgendaHomePage] create failed:", error);
      toast({
        title: "Failed to create agenda",
        description: error instanceof Error ? error.message : "Please try again",
        status: "error",
        duration: 5000,
      });
      setIsCreating(false);
    }
  };

  const charCount = sourceText.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Flex
      direction="column"
      w="full"
      minH="100dvh"
      bg="gray.50"
      overflowY="auto"
    >
      {/* Navy header banner */}
      <Box
        w="full"
        bg="linear-gradient(135deg, #152a4e 0%, #1a3260 60%, #1e40af 100%)"
        px={{ base: 4, md: 8 }}
        py={{ base: 8, md: 10 }}
      >
        <Flex direction="column" align="center" maxW="2xl" mx="auto" gap={2}>
          <Badge
            colorScheme="blue"
            bg="whiteAlpha.200"
            color="white"
            fontSize="xs"
            px={3}
            py={1}
            borderRadius="full"
            letterSpacing="wide"
            textTransform="uppercase"
          >
            AI-Powered
          </Badge>
          <Heading
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            color="white"
            textAlign="center"
            letterSpacing="tight"
          >
            Create a Meeting Agenda
          </Heading>
          <Text fontSize={{ base: "sm", md: "md" }} color="whiteAlpha.800" textAlign="center">
            Paste your meeting notes and let AI generate a structured agenda in seconds
          </Text>
        </Flex>
      </Box>

      {/* Main content */}
      <Flex
        direction={{ base: "column", lg: "row" }}
        gap={6}
        maxW="5xl"
        mx="auto"
        w="full"
        px={{ base: 4, md: 6 }}
        py={{ base: 6, md: 8 }}
      >
        {/* Form card */}
        <Box
          flex="1"
          bg="white"
          borderRadius="xl"
          boxShadow="0 2px 16px rgba(21,42,78,0.10)"
          border="1px solid"
          borderColor="gray.100"
          overflow="hidden"
        >
          {/* Card header */}
          <Box
            px={6}
            py={4}
            borderBottom="1px solid"
            borderColor="gray.100"
            bg="gray.50"
          >
            <Flex align="center" gap={2}>
              <Icon as={FaCalendarAlt} color="#1e40af" boxSize={4} />
              <Text fontWeight="semibold" color="gray.700" fontSize="sm">
                Meeting Details
              </Text>
            </Flex>
          </Box>

          <VStack spacing={4} p={6} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={1}>
                Agenda Title{" "}
                <Text as="span" color="gray.400" fontWeight="normal">
                  (optional)
                </Text>
              </Text>
              <Input
                placeholder="e.g., Q2 Board Meeting, Team Standup"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="md"
                maxLength={255}
                borderColor="gray.200"
                _hover={{ borderColor: "#1e40af" }}
                _focus={{ borderColor: "#1e40af", boxShadow: "0 0 0 1px #1e40af" }}
                borderRadius="lg"
              />
            </Box>

            <Box>
              <Flex justify="space-between" align="center" mb={1}>
                <Text fontSize="sm" fontWeight="medium" color="gray.600">
                  Meeting Context{" "}
                  <Text as="span" color="red.400">
                    *
                  </Text>
                </Text>
                <Text fontSize="xs" color={isOverLimit ? "red.500" : "gray.400"}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </Text>
              </Flex>
              <Textarea
                placeholder="Paste meeting notes, discussion topics, previous action items, or any context that should be covered in the agenda..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={10}
                resize="vertical"
                size="md"
                borderColor={isOverLimit ? "red.300" : "gray.200"}
                _hover={{ borderColor: isOverLimit ? "red.400" : "#1e40af" }}
                _focus={{
                  borderColor: isOverLimit ? "red.400" : "#1e40af",
                  boxShadow: isOverLimit ? "0 0 0 1px #fc8181" : "0 0 0 1px #1e40af",
                }}
                fontSize={{ base: "sm", md: "md" }}
                borderRadius="lg"
              />
            </Box>

            <Button
              rightIcon={<FaMagic />}
              size="lg"
              onClick={handleSubmit}
              isLoading={isCreating}
              loadingText="Generating agenda..."
              isDisabled={!sourceText.trim() || isOverLimit}
              w="full"
              borderRadius="lg"
              bg="linear-gradient(135deg, #152a4e 0%, #1e40af 100%)"
              color="white"
              fontWeight="semibold"
              _hover={{
                bg: "linear-gradient(135deg, #1a3260 0%, #1d4ed8 100%)",
                transform: "translateY(-1px)",
                boxShadow: "0 4px 16px rgba(30,64,175,0.35)",
              }}
              _active={{ transform: "translateY(0)" }}
              _disabled={{ opacity: 0.5, cursor: "not-allowed", transform: "none", boxShadow: "none" }}
              transition="all 0.2s"
            >
              Generate Agenda
            </Button>
          </VStack>
        </Box>

        {/* Tips sidebar */}
        <Box w={{ base: "full", lg: "260px" }} flexShrink={0}>
          <VStack spacing={3} align="stretch">
            <Box
              bg="white"
              borderRadius="xl"
              boxShadow="0 2px 12px rgba(21,42,78,0.08)"
              border="1px solid"
              borderColor="gray.100"
              overflow="hidden"
            >
              <Box
                px={4}
                py={3}
                bg="linear-gradient(135deg, #152a4e 0%, #1a3260 100%)"
              >
                <Text fontSize="sm" fontWeight="semibold" color="white">
                  Tips for better agendas
                </Text>
              </Box>
              <VStack spacing={0} align="stretch" divider={<Box borderBottom="1px solid" borderColor="gray.50" />}>
                {TIPS.map((tip, i) => (
                  <Flex key={i} px={4} py={3} gap={3} align="flex-start">
                    <Icon as={tip.icon} color="#1e40af" boxSize={3.5} mt={0.5} flexShrink={0} />
                    <Text fontSize="xs" color="gray.600" lineHeight="snug">
                      {tip.text}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            </Box>

            <Box
              bg="blue.50"
              border="1px solid"
              borderColor="blue.100"
              borderRadius="xl"
              p={4}
            >
              <Text fontSize="xs" color="blue.700" fontWeight="medium" mb={1}>
                How it works
              </Text>
              <Text fontSize="xs" color="blue.600" lineHeight="tall">
                Our AI reads your notes and creates a structured, professional meeting agenda with
                clear sections, time allocations, and action items.
              </Text>
            </Box>
          </VStack>
        </Box>
      </Flex>
    </Flex>
  );
}
