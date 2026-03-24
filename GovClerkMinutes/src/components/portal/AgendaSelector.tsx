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
  onSelect: (agendaId: string, version: number | null) => void;
};

type AgendaOption = {
  id: number;
  seriesId: string;
  title: string | null;
  status: string;
  updatedAt: string;
  createdAt: string;
};

type AgendaVersion = {
  id: number;
  version: number;
  content: string | null;
  status: string;
  updatedAt: string;
};

type AgendaDetail = {
  id: number;
  seriesId: string;
  title: string | null;
  versions: AgendaVersion[];
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch agendas");
  }
  return response.json();
};

export default function AgendaSelector({ selectedId, selectedVersion, onSelect }: Props) {
  const { orgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const url = orgId
    ? `/api/agendas?orgId=${encodeURIComponent(orgId)}&limit=50`
    : "/api/agendas?limit=50";

  const { data, isLoading } = useSWR<{ agendas: AgendaOption[] }>(url, fetcher, {
    revalidateOnFocus: false,
  });

  // Fetch versions for selected agenda
  const { data: agendaDetail } = useSWR<AgendaDetail>(
    selectedId ? `/api/agendas/by-series/${selectedId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const versions = agendaDetail?.versions || [];

  const agendas = useMemo(() => data?.agendas || [], [data?.agendas]);

  const filteredAgendas = useMemo(() => {
    if (!searchQuery) {
      return agendas;
    }
    const query = searchQuery.toLowerCase();
    return agendas.filter((a) => (a.title || "Untitled").toLowerCase().includes(query));
  }, [agendas, searchQuery]);

  const selectedAgenda = agendas.find((a) => a.seriesId === selectedId);

  // Set default version when agenda is selected
  useEffect(() => {
    if (selectedId && versions.length > 0 && !selectedVersion) {
      onSelect(selectedId, versions.length); // Default to latest version
    }
  }, [selectedId, versions.length, selectedVersion, onSelect]);

  const handleSelect = (agenda: AgendaOption) => {
    // Portal uses series_id as the agenda identifier, version will be set after versions are loaded
    onSelect(agenda.seriesId, null);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
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
            placeholder={selectedAgenda?.title || "Search agendas..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            bg={selectedAgenda ? "purple.50" : "white"}
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
          ) : filteredAgendas.length === 0 ? (
            <Box p={4} textAlign="center">
              <Text fontSize="sm" color="gray.500">
                {searchQuery ? "No agendas found" : "No agendas available"}
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
              {filteredAgendas.map((agenda) => (
                <Box
                  key={agenda.seriesId}
                  as="button"
                  w="full"
                  textAlign="left"
                  px={4}
                  py={3}
                  borderBottom="1px solid"
                  borderColor="gray.50"
                  _hover={{ bg: "gray.50" }}
                  _last={{ borderBottom: "none" }}
                  onClick={() => handleSelect(agenda)}
                >
                  <HStack justify="space-between">
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.800" isTruncated>
                        {agenda.title || "Untitled Agenda"}
                      </Text>
                      <HStack spacing={2} mt={0.5}>
                        <Text fontSize="xs" color="gray.500">
                          {formatDate(agenda.createdAt)}
                        </Text>
                      </HStack>
                    </Box>
                    {agenda.seriesId === selectedId && <HiCheck color="#805AD5" size={18} />}
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

      {/* Version selector - shown when agenda is selected and has multiple versions */}
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
