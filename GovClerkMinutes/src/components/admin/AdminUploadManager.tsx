import { useState, useCallback } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  VStack,
  Flex,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiUpload } from "react-icons/fi";
import { useDropzone } from "react-dropzone";
import useFileUploadHandler from "@/hooks/useFileUploadHandler";
import { LookupUserApiResponse } from "@/pages/api/admin/lookup-user";

type AdminUploadManagerProps = {};

export default function AdminUploadManager({}: AdminUploadManagerProps) {
  const [identifier, setIdentifier] = useState("");
  const [userInfo, setUserInfo] = useState<LookupUserApiResponse | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const toast = useToast();

  const onUploadComplete = useCallback(
    (transcriptId: number, fileName: string) => {
      toast({
        status: "success",
        title: "Upload successful",
        description: `File "${fileName}" uploaded for ${userInfo?.email}. Transcript ID: ${transcriptId}`,
        duration: 5000,
      });

      setUploadedFiles([]);
      setIdentifier("");
      setUserInfo(null);
    },
    [toast, userInfo?.email]
  );

  const { onDrop, isTransitioning } = useFileUploadHandler({
    impersonatedUserId: userInfo?.userId,
    onUploadComplete,
  });

  const borderColor = useColorModeValue("gray.300", "gray.600");
  const bgColor = useColorModeValue("gray.50", "gray.700");

  const lookupUser = async () => {
    if (!identifier.trim()) {
      toast({ status: "error", title: "Please enter an email or user ID" });
      return;
    }

    setIsLookingUp(true);
    setUserInfo(null);

    try {
      const res = await fetch("/api/admin/lookup-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to lookup user");
      }

      setUserInfo(data);
      toast({
        status: "success",
        title: "User found",
        description: `Found user: ${data.email}`,
        duration: 3000,
      });
    } catch (error) {
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

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!userInfo) {
        toast({
          status: "error",
          title: "No user selected",
          description: "Please lookup a user first before uploading files",
        });
        return;
      }

      setUploadedFiles(acceptedFiles);
      await onDrop(acceptedFiles);
    },
    [userInfo, toast, onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    disabled: !userInfo || isTransitioning,
    multiple: false,
  });

  return (
    <Box height="100%" overflowY="auto" pr={2}>
      <Heading size="md" mb={4} color="purple.700">
        Upload Files for Users
      </Heading>

      <Text mb={6} color="gray.600">
        Upload files on behalf of users without deducting their tokens. This is useful for providing
        customer support or handling special cases.
      </Text>

      <Stack spacing={6}>
        {/* User Lookup Section */}
        <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
          <Heading size="sm" mb={3}>
            Step 1: Find User
          </Heading>
          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <FormControl flex={1}>
              <FormLabel>Email or User ID</FormLabel>
              <Input
                placeholder="user@example.com or user_123456"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLookingUp}
              />
            </FormControl>
            <Button
              colorScheme="blue"
              onClick={lookupUser}
              isLoading={isLookingUp}
              loadingText="Looking up..."
              alignSelf={{ base: "stretch", md: "flex-end" }}
            >
              Lookup User
            </Button>
          </Stack>
        </Box>

        {/* User Info Display */}
        {userInfo && (
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
                <Box textAlign="right">
                  <Text fontWeight="bold">Current Tokens:</Text>
                  <Text
                    fontSize="xl"
                    fontWeight="bold"
                    color={userInfo.tokens && userInfo.tokens > 0 ? "green.500" : "red.500"}
                  >
                    {userInfo.tokens !== undefined ? userInfo.tokens.toLocaleString() : "--"}
                  </Text>
                </Box>
              </Flex>
            </Stack>
          </Alert>
        )}

        {/* Upload Section */}
        <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
          <Heading size="sm" mb={3}>
            Step 2: Upload File
          </Heading>

          {!userInfo ? (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Text>Please lookup a user first before uploading files.</Text>
            </Alert>
          ) : (
            <Box
              {...getRootProps()}
              p={8}
              borderWidth="2px"
              borderStyle="dashed"
              borderColor={isDragActive ? "blue.400" : borderColor}
              borderRadius="md"
              bg={isDragActive ? "blue.50" : bgColor}
              cursor={isTransitioning ? "not-allowed" : "pointer"}
              opacity={isTransitioning ? 0.6 : 1}
              transition="all 0.2s"
              _hover={{
                borderColor: "blue.400",
                bg: "blue.50",
              }}
            >
              <input {...getInputProps()} />
              <VStack spacing={4} textAlign="center">
                <Icon as={FiUpload} boxSize={12} color={isDragActive ? "blue.400" : "gray.400"} />
                <VStack spacing={2}>
                  <Text fontWeight="bold" fontSize="lg">
                    {isDragActive
                      ? "Drop the file here!"
                      : isTransitioning
                        ? "Uploading..."
                        : "Upload File for User"}
                  </Text>
                  <Text color="gray.600">
                    {isTransitioning
                      ? "Please wait while the file is being uploaded..."
                      : "Drag and drop a file here, or click to browse"}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    MP3, MP4, WAV, DOC, TXT, and more
                  </Text>
                </VStack>
              </VStack>
            </Box>
          )}

          {uploadedFiles.length > 0 && (
            <Box
              mt={4}
              p={3}
              bg="green.50"
              borderRadius="md"
              borderWidth="1px"
              borderColor="green.200"
            >
              <Text fontWeight="medium" color="green.700">
                Selected file: {uploadedFiles[0].name}
              </Text>
              <Text fontSize="sm" color="green.600">
                Size: {(uploadedFiles[0].size / 1024 / 1024).toFixed(2)} MB
              </Text>
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
