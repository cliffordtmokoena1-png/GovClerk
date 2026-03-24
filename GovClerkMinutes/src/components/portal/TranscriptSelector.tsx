import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Input,
  VStack,
  HStack,
  Text,
  Spinner,
  InputGroup,
  InputLeftElement,
  FormControl,
  Select,
} from "@chakra-ui/react";
import { HiMagnifyingGlass, HiCheck } from "react-icons/hi2";
import useSWR from "swr";
import { useOrgContext } from "@/contexts/OrgContext";

type Props = {
  selectedId: string;
  selectedVersion: number | null;
  onSelect: (transcriptId: string, version: number | null) => void;
};

type TranscriptOption = {
  transcriptId: number;
  title: string;
  dateCreated: Date;
  type: "minutes" | "agenda";
};

type MinutesVersion = {
  version: number;
  updatedAt: string;
};

const fetcher = async ([url, orgId]: [string, string | null]) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch transcripts");
  }
  return response.json();
};

const versionsFetcher = async (url: string) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
};

export default function TranscriptSelector({ selectedId, selectedVersion, onSelect }: Props) {
  const { orgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useSWR<{ sidebarItems: TranscriptOption[] }>(
    ["/api/sidebar", orgId],
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch versions for selected transcript
  const { data: minutesData } = useSWR(
    selectedId ? `/api/get-minutes?transcriptId=${selectedId}` : null,
    async (url) => {
      const response = await fetch("/api/get-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: parseInt(selectedId) }),
      });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    { revalidateOnFocus: false }
  );

  const versions: MinutesVersion[] = useMemo(() => {
    if (!minutesData?.minutes || !Array.isArray(minutesData.minutes)) {
      return [];
    }
    return minutesData.minutes.map((_: string, index: number) => ({
      version: index + 1,
      updatedAt: new Date().toISOString(),
    }));
  }, [minutesData]);

  // Filter to only show minutes (transcripts), not agendas
  const transcripts = (data?.sidebarItems || []).filter((item) => item.type === "minutes");

  const filteredTranscripts = useMemo(() => {
    if (!searchQuery) {
      return transcripts;
    }
    const query = searchQuery.toLowerCase();
    return transcripts.filter((t) => t.title.toLowerCase().includes(query));
  }, [transcripts, searchQuery]);

  const selectedTranscript = transcripts.find((t) => String(t.transcriptId) === selectedId);

  // Set default version when transcript is selected
  useEffect(() => {
    if (selectedId && versions.length > 0 && !selectedVersion) {
      onSelect(selectedId, versions.length); // Default to latest version
    }
  }, [selectedId, versions.length, selectedVersion, onSelect]);

  const handleSelect = (transcript: TranscriptOption) => {
    // Portal stores transcript ID as string, version will be set after versions are loaded
    onSelect(String(transcript.transcriptId), null);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const version = parseInt(e.target.value);
    onSelect(selectedId, version);
  };

  const handleClear = () => {
    onSelect("", null);
    setIsOpen(false);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Box position="relative">
      <FormControl>
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <HiMagnifyingGlass color="gray" />
          </InputLeftElement>
          <Input
            placeholder={selectedTranscript ? selectedTranscript.title : "Search transcripts..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            bg={selectedTranscript ? "blue.50" : "white"}
          />
        </InputGroup>
      </FormControl>

      {isOpen && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={1}
          bg="white"
          borderRadius="md"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.200"
          zIndex={10}
          maxH="250px"
          overflowY="auto"
        >
          {isLoading ? (
            <Box p={4} textAlign="center">
              <Spinner size="sm" />
            </Box>
          ) : filteredTranscripts.length === 0 ? (
            <Box p={4} textAlign="center">
              <Text fontSize="sm" color="gray.500">
                {searchQuery ? "No transcripts found" : "No transcripts available"}
              </Text>
            </Box>
          ) : (
            <VStack spacing={0} align="stretch">
              {selectedId && (
                <Box
                  as="button"
                  w="full"
                  textAlign="left"
                  px={4}
                  py={2}
                  bg="gray.50"
                  borderBottom="1px solid"
                  borderColor="gray.100"
                  _hover={{ bg: "gray.100" }}
                  onClick={handleClear}
                >
                  <Text fontSize="sm" color="gray.500">
                    Clear selection
                  </Text>
                </Box>
              )}
              {filteredTranscripts.map((transcript) => (
                <Box
                  key={transcript.transcriptId}
                  as="button"
                  w="full"
                  textAlign="left"
                  px={4}
                  py={3}
                  borderBottom="1px solid"
                  borderColor="gray.50"
                  _hover={{ bg: "gray.50" }}
                  _last={{ borderBottom: "none" }}
                  onClick={() => handleSelect(transcript)}
                >
                  <HStack justify="space-between">
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.800" isTruncated>
                        {transcript.title}
                      </Text>
                      <HStack spacing={2} mt={0.5}>
                        <Text fontSize="xs" color="gray.500">
                          {formatDate(transcript.dateCreated)}
                        </Text>
                      </HStack>
                    </Box>
                    {String(transcript.transcriptId) === selectedId && (
                      <HiCheck color="#3182CE" size={18} />
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      )}

      {isOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={5}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Version selector - shown when transcript is selected and has multiple versions */}
      {selectedId && versions.length > 1 && (
        <Box mt={2}>
          <Text fontSize="xs" color="gray.600" mb={1}>
            Select version
          </Text>
          <Select
            size="sm"
            value={selectedVersion || versions.length}
            onChange={handleVersionChange}
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                Version {v.version}
                {v.version === versions.length ? " (latest)" : ""}
              </option>
            ))}
          </Select>
        </Box>
      )}
    </Box>
  );
}
