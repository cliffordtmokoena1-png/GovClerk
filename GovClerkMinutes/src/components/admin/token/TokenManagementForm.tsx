import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useToast,
  InputGroup,
  InputRightElement,
  Alert,
  AlertIcon,
  Skeleton,
} from "@chakra-ui/react";
import { useContactLookup } from "@/admin/whatsapp/hooks/useContactLookup";
import type { LookupUserApiResponse } from "@/pages/api/admin/lookup-user";
import TokenSituation from "@/components/admin/token/TokenSituation";

type Props = {
  onSuccess?: () => void;
  initialWhatsappId?: string;
};

export default function TokenManagementForm({ onSuccess, initialWhatsappId }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [tokenAmount, setTokenAmount] = useState<number>(100);
  const [tokenAction, setTokenAction] = useState<"add" | "subtract">("add");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(Boolean(initialWhatsappId));
  const [userInfo, setUserInfo] = useState<LookupUserApiResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [streamHoursToAdd, setStreamHoursToAdd] = useState<number>(1);
  const [isAddingStreamHours, setIsAddingStreamHours] = useState(false);

  const toast = useToast();

  // Look up contact by whatsapp id (phone) to derive an email for identifier
  const { contact, loading: contactLoading, notFound } = useContactLookup(initialWhatsappId);

  const handleLookupUser = async (overrideIdentifier?: string) => {
    const idToUse = (overrideIdentifier ?? identifier).trim();
    if (!idToUse) {
      toast({
        status: "error",
        title: "Input required",
        description: "Please enter an email or user ID",
      });
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setUserInfo(null);

    try {
      const res = await fetch("/api/admin/lookup-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: idToUse }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(
          `Server error (${res.status}): ${e instanceof Error ? e.message : "Invalid JSON"}`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to look up user");
      }

      setUserInfo(data);
    } catch (error) {
      setLookupError((error as Error).message);
      toast({
        status: "error",
        title: "User lookup failed",
        description: (error as Error).message,
        duration: 5000,
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Prefill identifier from contact, and auto trigger lookup once per contact change
  useEffect(() => {
    const emailFromContact = (contact?.email || "").trim();
    if (!emailFromContact) {
      if (notFound) {
        setIdentifier("");
        setIsLookingUp(false);
        setLookupError("No email found for this contact");
      }
      return;
    }
    setIdentifier(emailFromContact);
    // fire and forget lookup with the preferred identifier
    handleLookupUser(emailFromContact);
    // Only react when contact changes, similar to WhatsappFollowupForm pattern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.email, contactLoading]);

  const handleTokenOperation = async () => {
    await submitTokenOperation(tokenAmount, tokenAction, {
      resetAfter: true,
    });
  };

  const handleModifyToken = async (amount: number) => {
    await submitTokenOperation(amount, "add");
  };

  const handleAddStreamHours = async () => {
    if (!userInfo?.portalOrg) return;
    setIsAddingStreamHours(true);
    try {
      const res = await fetch("/api/admin/stream-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: userInfo.portalOrg.orgId, hours: streamHoursToAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({
        status: "success",
        title: "Streaming hours added",
        description: `Added ${streamHoursToAdd}h. New total: ${data.newStreamHoursIncluded}h`,
        duration: 4000,
      });
      // Refresh the lookup so the UI reflects the new values
      await handleLookupUser(userInfo.userId);
    } catch (err) {
      toast({ status: "error", title: "Failed", description: (err as Error).message });
    } finally {
      setIsAddingStreamHours(false);
    }
  };

  type SubmitOpts = { resetAfter?: boolean; successDescription?: string };
  const submitTokenOperation = async (
    amount: number,
    action: "add" | "subtract",
    opts: SubmitOpts = {}
  ) => {
    if (!userInfo) {
      toast({
        status: "error",
        title: "No user selected",
        description: "Please look up a user first",
      });
      return;
    }
    if (!amount || amount <= 0) {
      toast({
        status: "error",
        title: "Invalid amount",
        description: "Please enter a valid positive amount",
      });
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch("/api/admin/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userInfo.userId, amount, action }),
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(
          `Server error (${res.status}): ${e instanceof Error ? e.message : "Invalid JSON"}`
        );
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to process token operation");
      }
      toast({
        status: "success",
        title: "Success",
        description:
          opts.successDescription ??
          `Successfully ${action === "subtract" ? "deducted" : "added"} ${Math.abs(amount)} tokens`,
        duration: 4000,
      });
      // Re-fetch the user's updated balance so the admin can confirm the change
      if (userInfo) {
        try {
          const refreshRes = await fetch("/api/admin/lookup-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: userInfo.userId }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            setUserInfo(refreshData);
          }
        } catch {
          // ignore refresh errors — the operation itself succeeded
        }
      }
      if (opts.resetAfter) {
        setTokenAmount(100);
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      toast({
        status: "error",
        title: "Error",
        description: (error as Error).message,
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Stack spacing={5}>
      <FormControl isRequired>
        <FormLabel>Email or User ID</FormLabel>
        <InputGroup>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="email@example.com or user_..."
            isDisabled={isLookingUp || contactLoading}
          />
          <InputRightElement width="4.5rem" mx={2}>
            <Button
              h="1.75rem"
              size="sm"
              onClick={() => handleLookupUser()}
              isLoading={isLookingUp}
              isDisabled={contactLoading}
            >
              Look up
            </Button>
          </InputRightElement>
        </InputGroup>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Enter an email address or Clerk user ID
        </Text>
      </FormControl>

      {lookupError && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {lookupError}
        </Alert>
      )}

      {userInfo ? (
        <Alert status="success" borderRadius="md">
          <AlertIcon />
          <Stack spacing={0} width="100%">
            <Flex justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Text fontWeight="bold">User found:</Text>
                <Text>{userInfo.email}</Text>
                <Text>{userInfo.displayName}</Text>
                <Text fontSize="sm" color="gray.500">
                  ID: {userInfo.userId}
                </Text>
              </Box>
              <Stack spacing={2} textAlign="right">
                {/* User ID Tokens */}
                <Box>
                  <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                    User ID Tokens:
                  </Text>
                  <Text
                    fontSize="xl"
                    fontWeight="bold"
                    color={userInfo.tokens && userInfo.tokens > 0 ? "green.500" : "red.500"}
                  >
                    {userInfo.tokens !== undefined ? userInfo.tokens.toLocaleString() : "--"}
                  </Text>
                </Box>
                {/* Org Hours — only shown if the user has a portal org */}
                {userInfo.portalOrg && (
                  <Box>
                    <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                      Org Hours:
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="purple.500">
                      {Math.max(0, userInfo.portalOrg.streamHoursIncluded - userInfo.portalOrg.streamHoursUsed).toFixed(1)}h remaining
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {userInfo.portalOrg.streamHoursUsed.toFixed(1)} / {userInfo.portalOrg.streamHoursIncluded.toFixed(1)}h used
                    </Text>
                  </Box>
                )}
              </Stack>
            </Flex>
          </Stack>
        </Alert>
      ) : isLookingUp ? (
        <Box h="120px">
          <Stack flex="1">
            <Skeleton height="5" />
            <Skeleton height="5" width="80%" />
            <Skeleton height="5" width="60%" />
          </Stack>
        </Box>
      ) : null}

      <FormControl isRequired>
        <FormLabel>Action</FormLabel>
        <RadioGroup
          value={tokenAction}
          onChange={(val) => setTokenAction(val as "add" | "subtract")}
        >
          <HStack spacing={4}>
            <Radio value="add" colorScheme="green">
              Add Tokens
            </Radio>
            <Radio value="subtract" colorScheme="red">
              Remove Tokens
            </Radio>
          </HStack>
        </RadioGroup>
      </FormControl>

      <FormControl isRequired>
        <FormLabel>Amount</FormLabel>
        <NumberInput
          min={1}
          value={tokenAmount}
          onChange={(_, val) => setTokenAmount(isNaN(val) ? 0 : val)}
        >
          <NumberInputField placeholder="100" />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </FormControl>

      <Button
        mt={2}
        colorScheme={tokenAction === "add" ? "green" : "red"}
        onClick={handleTokenOperation}
        isLoading={isProcessing}
        loadingText="Processing..."
        isDisabled={!userInfo}
      >
        {tokenAction === "add" ? "Add Tokens" : "Remove Tokens"}
      </Button>

      {userInfo && (
        <TokenSituation
          userId={userInfo.userId}
          tokens={userInfo.tokens}
          onModifyToken={handleModifyToken}
        />
      )}

      {userInfo?.portalOrg && (
        <Box mt={4} p={3} borderWidth={1} borderRadius="md" borderColor="purple.200" bg="purple.50">
          <Heading size="xs" mb={2} color="purple.700">Portal Org</Heading>
          <Text fontSize="sm">Org ID: <strong>{userInfo.portalOrg.orgId}</strong></Text>
          <Text fontSize="sm">Tier: <strong>{userInfo.portalOrg.tier ?? "none"}</strong></Text>
          <Text fontSize="sm">Status: <strong>{userInfo.portalOrg.status}</strong></Text>
          <Text fontSize="sm">
            Streaming hours:{" "}
            <strong>
              {userInfo.portalOrg.streamHoursUsed.toFixed(2)} / {userInfo.portalOrg.streamHoursIncluded.toFixed(2)}
            </strong>{" "}
            hrs used this period
          </Text>
          <Box mt={3} pt={3} borderTopWidth={1} borderColor="purple.200">
            <Heading size="xs" mb={2} color="purple.700">Add Streaming Hours</Heading>
            <HStack>
              <NumberInput
                size="sm"
                value={streamHoursToAdd}
                onChange={(_, val) => setStreamHoursToAdd(val)}
                min={1}
                max={100}
                w="100px"
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Button
                size="sm"
                colorScheme="purple"
                isLoading={isAddingStreamHours}
                onClick={handleAddStreamHours}
              >
                Add Hours
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
    </Stack>
  );
}
