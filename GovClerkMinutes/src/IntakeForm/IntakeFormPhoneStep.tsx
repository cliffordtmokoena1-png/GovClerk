import "react-phone-number-input/style.css";

import { Text, Input } from "@chakra-ui/react";
import PhoneInput from "react-phone-number-input";
import { forwardRef } from "react";

function getPlaceholder(country: string) {
  switch (country) {
    case "GB":
      return "+44 20 7946 0958";
    case "ZA":
      return "+27 21 123 4567";
    default:
      return "+1 (555) 555-5555";
  }
}

type Props = {
  phone?: string;
  setPhone: (phone: string | undefined) => void;
  country: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export default function IntakeFormPhoneStep({ phone, setPhone, country, onKeyDown }: Props) {
  return (
    <>
      <Text fontSize="lg" textAlign="center" fontWeight="semibold">
        Enter your phone number
      </Text>
      <PhoneInput
        key="phone-step" // force mount on step change => reliable autofocus
        international
        autoFocus // let the inner input grab focus
        placeholder={getPlaceholder(country)}
        value={phone}
        onChange={setPhone}
        defaultCountry={country as any}
        inputComponent={ChakraInputAdapter}
        onKeyDown={onKeyDown}
      />
    </>
  );
}

const ChakraInputAdapter = forwardRef<HTMLInputElement, any>(({ onKeyDown, ...props }, ref) => {
  return <Input {...props} onKeyDown={onKeyDown} ref={ref} />;
});
ChakraInputAdapter.displayName = "ChakraInputAdapter";
