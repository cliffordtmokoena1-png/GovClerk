import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useBreakpointValue,
  useToast,
  Grid,
  GridItem,
  Text,
} from "@chakra-ui/react";
import { Device, Call } from "@twilio/voice-sdk";

// Dummy contacts data
const DUMMY_CONTACTS = [
  { id: "1", name: "Test User", phone: "+10000000000" },
  { id: "2", name: "Diana Majano", phone: "+15712054752" },
] as const;

type Props = {};

// Simple keypad component local to this page
function DialPad({
  value,
  onChange,
  onCall,
}: {
  value: string;
  onChange: (next: string) => void;
  onCall: (phone: string) => void;
}) {
  const toast = useToast();

  // Digits and special keys for a typical dial pad
  const keys = useMemo(() => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"], []);

  const handleKey = (k: string) => {
    onChange(value + k);
  };

  const handleBackspace = () => {
    if (value.length > 0) {
      onChange(value.slice(0, value.length - 1));
    }
  };

  const handleClear = () => onChange("");

  const handleCall = () => {
    const phone = value.trim();
    if (!phone) {
      toast({ title: "Enter a phone number", status: "warning", duration: 2000 });
      return;
    }
    onCall(phone);
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
      <Heading as="h2" size="sm" mb={3}>
        Dial Pad
      </Heading>

      <Flex gap={2} mb={3} align="center">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter number"
        />
        <Button variant="outline" onClick={handleBackspace}>
          ⌫
        </Button>
        <Button variant="ghost" onClick={handleClear}>
          Clear
        </Button>
      </Flex>

      <Grid templateColumns="repeat(3, 1fr)" gap={2} mb={4}>
        {keys.map((k) => (
          <GridItem key={k}>
            <Button onClick={() => handleKey(k)} w="100%">
              {k}
            </Button>
          </GridItem>
        ))}
      </Grid>

      <Button colorScheme="blue" w="100%" onClick={handleCall}>
        Call
      </Button>
    </Box>
  );
}

export default function ContactsPage(_props: Props) {
  const [dialNumber, setDialNumber] = useState<string>("");
  const [status, setStatus] = useState<string>("Initializing…");
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const deviceRef = useRef<Device | null>(null);
  const activeConnectionRef = useRef<Call | null>(null);
  const isDesktop = useBreakpointValue({ base: false, md: true });
  const toast = useToast();

  // Initialize the Twilio Device on mount
  useEffect(() => {
    let isMounted = true;

    async function setup() {
      try {
        setStatus("Fetching token…");
        const r = await fetch("/api/admin/twilio/get-token");
        if (!r.ok) {
          throw new Error("Failed to fetch Twilio token");
        }
        const data: { token: string } = await r.json();

        // Create and register device
        setStatus("Registering device…");
        const device = new Device(data.token, {});

        device.on("registered", () => {
          if (!isMounted) {
            return;
          }
          setIsReady(true);
          setStatus("Ready");
        });
        device.on("error", (e) => {
          if (!isMounted) {
            return;
          }
          setStatus("Error");
          toast({ title: e.message || "Twilio device error", status: "error" });
        });
        device.on("incoming", (connection) => {
          // We are not handling inbound calls yet; reject by default
          connection.reject();
        });
        await device.register();
        deviceRef.current = device;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          setStatus("Failed to initialize");
          toast({ title: message, status: "error" });
        }
      }
    }

    setup();

    return () => {
      isMounted = false;
      try {
        activeConnectionRef.current?.disconnect();
        deviceRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, [toast]);

  // When clicking Call on a contact row, populate the dial pad input
  const handleCallContact = (phone: string) => {
    setDialNumber(phone);
  };

  // Place a call using the Voice SDK
  const handlePlaceCall = async (phone: string) => {
    const device = deviceRef.current;
    if (!device) {
      toast({ title: "Device not ready yet", status: "warning" });
      return;
    }
    if (isCalling) {
      toast({ title: "Already in a call", status: "info" });
      return;
    }
    try {
      setIsCalling(true);
      setStatus("Connecting…");
      const conn = await device.connect({ params: { To: phone } });
      activeConnectionRef.current = conn;

      conn.on("accept", () => {
        setStatus("In call");
      });
      conn.on("disconnect", () => {
        setIsCalling(false);
        setStatus("Ready");
        activeConnectionRef.current = null;
      });
      conn.on("cancel", () => {
        setIsCalling(false);
        setStatus("Ready");
        activeConnectionRef.current = null;
      });
      conn.on("error", (e) => {
        setIsCalling(false);
        setStatus("Ready");
        activeConnectionRef.current = null;
        toast({ title: e.message || "Call error", status: "error" });
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setIsCalling(false);
      setStatus("Ready");
      toast({ title: message, status: "error" });
    }
  };

  return (
    <>
      <Head>
        <title>Contacts · Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Flex direction={isDesktop ? "row" : "column"} gap={4} h="100%" p={4}>
        {/* Left pane: contact list */}
        <Box flex={1} minW={0}>
          <Heading as="h2" size="md" mb={3}>
            Contacts
          </Heading>

          <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white">
            <Table size="sm">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {DUMMY_CONTACTS.map((contact) => (
                  <Tr key={contact.id} _hover={{ bg: "gray.50" }}>
                    <Td>{contact.name}</Td>
                    <Td>
                      <Text as="span" fontFamily="mono">
                        {contact.phone}
                      </Text>
                    </Td>
                    <Td textAlign="right">
                      <Button size="sm" onClick={() => handleCallContact(contact.phone)}>
                        Call
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>

        {/* Right pane: dial pad */}
        <Box flex={1} minW={0}>
          <Flex align="center" justify="space-between" mb={2}>
            <Heading as="h2" size="md">
              Dialer
            </Heading>
            <Text fontSize="sm" color={isReady ? "green.600" : "orange.600"}>
              {status}
            </Text>
          </Flex>
          <DialPad value={dialNumber} onChange={setDialNumber} onCall={handlePlaceCall} />
          <Flex mt={3} gap={2}>
            <Button
              colorScheme="red"
              isDisabled={!isCalling}
              onClick={() => {
                try {
                  activeConnectionRef.current?.disconnect();
                } catch {
                  // ignore
                }
              }}
            >
              Hang Up
            </Button>
            <Button
              isDisabled={isCalling || !isReady}
              onClick={() => {
                if (dialNumber.trim()) {
                  handlePlaceCall(dialNumber.trim());
                }
              }}
            >
              Call
            </Button>
          </Flex>
        </Box>
      </Flex>
    </>
  );
}
