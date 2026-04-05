import { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Heading,
  Text,
  Badge,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  Tooltip,
  useToast,
  Box,
} from "@chakra-ui/react";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { getPrettyPlanName } from "@/utils/price";
import type { TeamMember, ApiGetTeamMembersResponse } from "@/pages/api/team-members/index";

/** Minimal RFC-5322 email format check (client-safe). */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

type Props = {
  subscriptionData: ApiGetCustomerDetailsResponse;
};

const STATUS_COLORS: Record<TeamMember["status"], string> = {
  pending: "yellow",
  active: "green",
  revoked: "red",
};

export default function MembersSettings({ subscriptionData }: Props) {
  const toast = useToast();
  const planName = subscriptionData.planName ?? "Free";
  const prettyPlan = getPrettyPlanName(planName) || "Free";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [maxMembers, setMaxMembers] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/team-members");
      if (!res.ok) throw new Error("Failed to load members");
      const data: ApiGetTeamMembersResponse = await res.json();
      setMembers(data.members);
      setMaxMembers(data.maxMembers);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load team members. Please refresh.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const activeCount = members.filter((m) => m.status !== "revoked").length;
  // +1 for the owner
  const totalCount = activeCount + 1;
  const atLimit = totalCount >= maxMembers;

  const handleInvite = async () => {
    setInviteError("");
    if (!inviteEmail) {
      setInviteError("Email address is required.");
      return;
    }
    if (!isValidEmail(inviteEmail)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      const res = await fetch("/api/team-members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite.");
        return;
      }
      setInviteEmail("");
      toast({
        title: "Invite sent",
        description: `An invitation has been sent to ${inviteEmail}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      await fetchMembers();
    } catch {
      setInviteError("Failed to send invite. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    setActionLoading((prev) => ({ ...prev, [member.id]: true }));
    try {
      const res = await fetch("/api/team-members/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove member");
      }
      toast({
        title: "Member removed",
        description: `${member.member_email} has been removed.`,
        status: "info",
        duration: 4000,
        isClosable: true,
      });
      await fetchMembers();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove member.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  const handleResend = async (member: TeamMember) => {
    setActionLoading((prev) => ({ ...prev, [member.id]: true }));
    try {
      const res = await fetch("/api/team-members/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to resend invite");
      }
      toast({
        title: "Invite resent",
        description: `A new invitation has been sent to ${member.member_email}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to resend invite.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  const visibleMembers = members.filter((m) => m.status !== "revoked");

  return (
    <Stack spacing={6} w="full" maxW="700px" mx="auto" p={4}>
      {/* Header */}
      <Stack spacing={1}>
        <HStack spacing={3} align="center">
          <Heading size="lg">Team Members</Heading>
          <Badge colorScheme="blue" fontSize="sm" px={2} py={1} borderRadius="md">
            {prettyPlan}
          </Badge>
        </HStack>
        <Text color="gray.600">
          Invite additional users to access your GovClerk Minutes dashboard.
        </Text>
        <Text fontWeight="semibold" color={atLimit ? "orange.500" : "gray.700"}>
          {totalCount} / {maxMembers} members
        </Text>
      </Stack>

      {/* Upgrade prompt when at limit */}
      {atLimit && planName !== "Premium" && planName !== "Premium_Annual" && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Text fontSize="sm">
            You&apos;ve reached your plan&apos;s member limit.{" "}
            <strong>Upgrade your plan</strong> to add more members.
          </Text>
        </Alert>
      )}

      {/* Member list */}
      {isLoading ? (
        <HStack spacing={2}>
          <Spinner size="sm" />
          <Text color="gray.500">Loading members…</Text>
        </HStack>
      ) : visibleMembers.length === 0 ? (
        <Box
          p={4}
          borderRadius="md"
          bg="gray.50"
          border="1px solid"
          borderColor="gray.200"
          textAlign="center"
        >
          <Text color="gray.500" fontSize="sm">
            No team members yet. Invite someone below.
          </Text>
        </Box>
      ) : (
        <Box overflowX="auto" borderRadius="md" border="1px solid" borderColor="gray.200">
          <Table size="sm" variant="simple">
            <Thead bg="gray.50">
              <Tr>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Role</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibleMembers.map((member) => (
                <Tr key={member.id}>
                  <Td fontSize="sm">{member.member_email}</Td>
                  <Td>
                    <Badge colorScheme={STATUS_COLORS[member.status]} fontSize="xs">
                      {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                    </Badge>
                  </Td>
                  <Td fontSize="sm">
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      {member.status === "pending" && (
                        <Button
                          size="xs"
                          variant="outline"
                          colorScheme="blue"
                          isLoading={actionLoading[member.id]}
                          onClick={() => handleResend(member)}
                        >
                          Resend
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="red"
                        isLoading={actionLoading[member.id]}
                        onClick={() => handleRemove(member)}
                      >
                        Remove
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Invite form */}
      <Stack spacing={3} p={4} borderRadius="md" bg="gray.50" border="1px solid" borderColor="gray.200">
        <Text fontWeight="semibold" fontSize="sm">
          Invite a new member
        </Text>
        <FormControl isInvalid={!!inviteError}>
          <FormLabel fontSize="sm">Email address</FormLabel>
          <HStack>
            <Input
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError("");
              }}
              isDisabled={atLimit || isInviting}
              size="sm"
              bg="white"
            />
            <Tooltip
              label={atLimit ? "Upgrade your plan to add more members" : undefined}
              isDisabled={!atLimit}
            >
              <Button
                colorScheme="blue"
                size="sm"
                onClick={handleInvite}
                isLoading={isInviting}
                isDisabled={atLimit}
                flexShrink={0}
              >
                Send Invite
              </Button>
            </Tooltip>
          </HStack>
          {inviteError && <FormErrorMessage>{inviteError}</FormErrorMessage>}
        </FormControl>
      </Stack>
    </Stack>
  );
}
