import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  Button,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  FiPhoneCall,
  FiMessageSquare,
  FiSend,
  FiCheckCircle,
  FiUsers,
  FiRefreshCw,
} from "react-icons/fi";
import type { AiActivitiesMetrics } from "@/ai-agent/types";

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  description: string;
}

function MetricCard({ label, value, icon, color, description }: MetricCardProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  return (
    <GridItem>
      <Box
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        p={5}
        shadow="sm"
        _hover={{ shadow: "md", borderColor: color }}
        transition="all 0.2s"
      >
        <Flex align="center" mb={3} gap={3}>
          <Flex
            align="center"
            justify="center"
            w={10}
            h={10}
            borderRadius="full"
            bg={`${color.split(".")[0]}.50`}
          >
            <Icon as={icon} color={color} boxSize={5} />
          </Flex>
          <Text fontWeight="semibold" fontSize="sm" color="gray.600">
            {label}
          </Text>
        </Flex>
        <Stat>
          <StatNumber fontSize="3xl" fontWeight="bold" color={color}>
            {value.toLocaleString()}
          </StatNumber>
          <StatLabel fontSize="xs" color="gray.400" mt={1}>
            {description}
          </StatLabel>
        </Stat>
      </Box>
    </GridItem>
  );
}

export default function AiActivities() {
  const [metrics, setMetrics] = useState<AiActivitiesMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-activities");
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const data: AiActivitiesMetrics = await res.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const metricCards: (MetricCardProps & { key: string })[] = metrics
    ? [
        {
          key: "calls-received",
          label: "Calls Received",
          value: metrics.callsReceived,
          icon: FiPhoneCall,
          color: "blue.500",
          description: "Unique inbound conversations today",
        },
        {
          key: "calls-made",
          label: "Calls Made",
          value: metrics.callsMade,
          icon: FiPhoneCall,
          color: "cyan.500",
          description: "Unique outbound AI conversations today",
        },
        {
          key: "messages-processed",
          label: "Messages Processed",
          value: metrics.messagesProcessed,
          icon: FiMessageSquare,
          color: "purple.500",
          description: "AI-generated replies sent today",
        },
        {
          key: "payment-plans-sent",
          label: "Payment Plans Sent",
          value: metrics.paymentPlansSent,
          icon: FiSend,
          color: "orange.500",
          description: "Payment links delivered by AI today",
        },
        {
          key: "paid-plans",
          label: "Paid Plans",
          value: metrics.paidPlans,
          icon: FiCheckCircle,
          color: "green.500",
          description: "Successful conversions via AI today",
        },
        {
          key: "follow-up",
          label: "Follow-ups Needed",
          value: metrics.followUpCount,
          icon: FiUsers,
          color: "red.400",
          description: "Contacts flagged for follow-up",
        },
      ]
    : [];

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={2}>
        <Heading size="md" color="purple.600">
          AI Agent Activity Dashboard
        </Heading>
        <Button
          size="sm"
          leftIcon={<Icon as={FiRefreshCw} />}
          variant="outline"
          colorScheme="purple"
          isLoading={loading}
          onClick={fetchMetrics}
        >
          Refresh
        </Button>
      </Flex>
      {metrics && (
        <Text fontSize="xs" color="gray.400" mb={4}>
          Reporting period: {metrics.date}
        </Text>
      )}
      <Divider mb={5} />

      {loading && !metrics && (
        <Flex justify="center" align="center" minH="200px">
          <Spinner size="xl" color="purple.500" />
        </Flex>
      )}

      {error && (
        <Box bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md" p={4}>
          <Text color="red.600" fontWeight="medium">
            Failed to load AI activity metrics
          </Text>
          <Text color="red.500" fontSize="sm" mt={1}>
            {error}
          </Text>
        </Box>
      )}

      {metrics && (
        <Grid
          templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
          gap={4}
        >
          {metricCards.map((card) => (
            <MetricCard
              key={card.key}
              label={card.label}
              value={card.value}
              icon={card.icon}
              color={card.color}
              description={card.description}
            />
          ))}
        </Grid>
      )}
    </Box>
  );
}
