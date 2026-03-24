import {
  Box,
  Heading,
  FormControl,
  FormLabel,
  Select,
  HStack,
  Text,
  Button,
} from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";
import { formatPrice, generateCreditOptions, getPriceUnit } from "@/utils/price";

type Props = {
  country: string;
  selectedToken: number;
  onChangeSelectedToken: (value: number) => void;
  paygTotalPrice: number;
  pricePerCredit: number;
  savingsAmount: number;
  isOtpLoading: boolean;
  onOtp: () => void;
  containerProps?: BoxProps;
};

export default function PaywallOTPSection({
  country,
  selectedToken,
  onChangeSelectedToken,
  paygTotalPrice,
  pricePerCredit,
  savingsAmount,
  isOtpLoading,
  onOtp,
  containerProps,
}: Props) {
  return (
    <Box mt={4} p={4} borderWidth="1px" borderRadius="md" bg="gray.50" {...containerProps}>
      <Heading size="sm" mb={3}>
        Buy one-time tokens
      </Heading>
      <FormControl mb={3}>
        <FormLabel fontSize="sm">Select tokens</FormLabel>
        <Select
          value={selectedToken}
          onChange={(e) => onChangeSelectedToken(parseInt(e.target.value))}
        >
          {generateCreditOptions().map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormControl>
      <HStack justifyContent="space-between" mb={1}>
        <Text fontSize="xs" color="gray.500">
          Price per token
        </Text>
        <Text fontSize="xs" color="gray.700">
          {getPriceUnit(country)}
          {formatPrice(pricePerCredit)}
        </Text>
      </HStack>
      <HStack justifyContent="space-between">
        <Text fontSize="sm" color="gray.400">
          Total due
        </Text>
        <Text fontSize="sm" color="gray.700" fontWeight="bold">
          {savingsAmount > 0 ? (
            <>
              <Text as="s" color="gray.400" mr={2}>
                {getPriceUnit(country)}
                {formatPrice(paygTotalPrice + savingsAmount)}
              </Text>
              {getPriceUnit(country)}
              {formatPrice(paygTotalPrice)}
            </>
          ) : (
            <>
              {getPriceUnit(country)}
              {formatPrice(paygTotalPrice)}
            </>
          )}
        </Text>
      </HStack>

      {savingsAmount > 0 && (
        <HStack justifyContent="end" gap={1}>
          <Text fontSize="xs" color="green.600">
            You saved
          </Text>
          <Text fontSize="xs" color="green.700" fontWeight="semibold">
            {getPriceUnit(country)}
            {formatPrice(savingsAmount)}!
          </Text>
        </HStack>
      )}

      <Button colorScheme="blue" width="full" mt={3} isLoading={isOtpLoading} onClick={onOtp}>
        Buy Tokens
      </Button>
    </Box>
  );
}
