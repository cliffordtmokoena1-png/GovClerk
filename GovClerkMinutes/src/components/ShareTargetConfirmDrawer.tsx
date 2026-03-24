import React from "react";
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Button,
  Text,
  VStack,
  HStack,
  Icon,
  Box,
} from "@chakra-ui/react";
import { FiFile, FiUpload, FiAlertCircle } from "react-icons/fi";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  fileSize: number;
  fileType: string;
  isError?: boolean;
  errorMessage?: string;
};

const BYTES_PER_UNIT = 1024;
const SIZE_UNITS = ["Bytes", "KB", "MB", "GB"];

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const unitIndex = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT));
  const size = bytes / Math.pow(BYTES_PER_UNIT, unitIndex);
  return `${Math.round(size * 100) / 100} ${SIZE_UNITS[unitIndex]}`;
}

export default function ShareTargetConfirmDrawer({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  fileSize,
  fileType,
  isError = false,
  errorMessage,
}: Props) {
  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose}>
      <DrawerOverlay zIndex={9} />
      <DrawerContent borderTopRadius="xl" zIndex={10}>
        <DrawerCloseButton />
        <DrawerHeader borderBottomWidth="1px">
          <HStack spacing={2}>
            <Icon
              as={isError ? FiAlertCircle : FiUpload}
              boxSize={5}
              color={isError ? "red.500" : "blue.500"}
            />
            <Text>{isError ? "Share Error" : "Upload File"}</Text>
          </HStack>
        </DrawerHeader>

        <DrawerBody py={6}>
          {isError ? (
            <VStack spacing={4} align="stretch">
              <Box p={4} bg="red.50" borderRadius="lg" borderWidth="1px" borderColor="red.200">
                <Text color="red.800" fontSize="md">
                  {errorMessage}
                </Text>
              </Box>
            </VStack>
          ) : (
            <VStack spacing={4} align="stretch">
              <Box p={4} bg="gray.50" borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                <HStack spacing={3}>
                  <Icon as={FiFile} boxSize={6} color="gray.600" />
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontWeight="semibold" fontSize="md" noOfLines={1}>
                      {fileName}
                    </Text>
                    <HStack spacing={2} fontSize="sm" color="gray.600">
                      <Text>{formatFileSize(fileSize)}</Text>
                      {fileType && (
                        <>
                          <Text>•</Text>
                          <Text>{fileType}</Text>
                        </>
                      )}
                    </HStack>
                  </VStack>
                </HStack>
              </Box>

              <Text color="gray.600" fontSize="sm">
                Do you want to upload this file to generate meeting minutes?
              </Text>
            </VStack>
          )}
        </DrawerBody>

        <DrawerFooter borderTopWidth="1px">
          {isError ? (
            <Button colorScheme="red" onClick={onClose} w="full">
              Dismiss
            </Button>
          ) : (
            <HStack spacing={3} w="full">
              <Button variant="outline" onClick={onClose} flex={1}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={onConfirm} flex={1}>
                Upload
              </Button>
            </HStack>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
