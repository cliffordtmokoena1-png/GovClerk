import React from "react";
import { Box, FormControl, FormLabel, Input, Spinner, Text } from "@chakra-ui/react";
import type { ContactProperties } from "../../../admin/whatsapp/types";

type Props = {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  contact?: ContactProperties;
  isRequired?: boolean;
  label?: string;
  placeholder?: string;
};

export default function PhoneInputWithLookup({
  value,
  onChange,
  loading = false,
  contact,
  isRequired = false,
  label = "Phone number (incl. country code)",
  placeholder = "274155551212",
}: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <>
      <FormControl id="phone" isRequired={isRequired}>
        <FormLabel>{label}</FormLabel>
        <Input type="tel" placeholder={placeholder} value={value} onChange={handleChange} />
      </FormControl>
      {value.trim() !== "" && (
        <>
          {loading ? (
            <Box mt={2} display="flex" alignItems="center" gap={2} color="gray.600">
              <Spinner size="sm" />
              <Text fontSize="sm">Searching for contacts…</Text>
            </Box>
          ) : contact ? (
            <Box p={2} borderRadius="md" boxShadow="xs" bg="yellow.50">
              <Text fontSize="sm">
                <strong>{contact.name || "Unnamed"}</strong>
              </Text>
              <Text fontSize="xs" color="gray.600">
                {contact.email || "No email"}
              </Text>
              <Text fontSize="xs" color="gray.600">
                📞 {contact.phone}
              </Text>
            </Box>
          ) : (
            <Text mt={2} fontSize="sm" color="gray.500">
              No matching contact found.
            </Text>
          )}
        </>
      )}
    </>
  );
}
