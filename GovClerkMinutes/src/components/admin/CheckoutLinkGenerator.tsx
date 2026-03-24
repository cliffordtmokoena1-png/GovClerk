import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Stack,
  Text,
  useClipboard,
  useToast,
} from "@chakra-ui/react";
import { Environment } from "@/utils/environment";
import { PaidSubscriptionPlan } from "@/utils/price";

type Plan = {
  // TODO: support Lite plan better
  id: PaidSubscriptionPlan | "Lite";
  name: string;
};
const plans: Plan[] = [
  { id: "Essential", name: "Essential Plan (Monthly)" },
  { id: "Essential_Annual", name: "Essential Plan (Annual)" },
  { id: "Professional", name: "Professional Plan (Monthly)" },
  { id: "Professional_Annual", name: "Professional Plan (Annual)" },
  { id: "Elite", name: "Elite Plan (Monthly)" },
  { id: "Elite_Annual", name: "Elite Plan (Annual)" },
  { id: "Premium", name: "Premium Plan (Monthly)" },
  { id: "Premium_Annual", name: "Premium Plan (Annual)" },
  // Legacy plans
  { id: "Basic", name: "Basic Plan (Legacy)" },
  { id: "Basic_Annual", name: "Annual Basic Plan (Legacy)" },
  { id: "Pro", name: "Pro Plan (Legacy)" },
  { id: "Pro_Annual", name: "Annual Pro Plan (Legacy)" },
  { id: "Lite", name: "Lite Plan" },
];

const countries = [
  { id: "ZA", name: "South Africa" },
  { id: "US", name: "United States of America" },
  { id: "IN", name: "India" },
  { id: "PH", name: "Philippines" },
];

type Props = {
  env: Environment;
};
export default function CheckoutLinkGenerator({ env }: Props) {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(countries[0].id);
  const [plan, setPlan] = useState(plans[0].id);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [sendInEmail, setSendInEmail] = useState(true);
  const { onCopy, hasCopied, setValue } = useClipboard("");
  const toast = useToast();

  const validateInput = () => {
    if (!email) {
      toast({ status: "error", title: "Email is required" });
      return false;
    }
    if (!countries.some((c) => c.id === country)) {
      toast({ status: "error", title: "Invalid country" });
      return false;
    }
    if (!plans.some((p) => p.id === plan)) {
      toast({ status: "error", title: "Invalid plan" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      setIsProcessing(true);

      if (!validateInput()) {
        toast({
          status: "error",
          title: "Error",
          description: "Please fill all fields correctly.",
        });
        return;
      }

      const res = await fetch("/api/admin/make-checkout-link", {
        method: "POST",
        body: JSON.stringify({ email, env, country, plan, sendInEmail }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to create checkout session");
      }

      const data = await res.json();
      const url: string = data.url;
      const emailed: boolean | undefined = data.emailed;

      setCheckoutUrl(url);
      setValue(url);
      toast({
        status: "success",
        title: emailed ? "Checkout link created and emailed" : "Checkout link created",
        duration: 3000,
      });
    } catch (err) {
      toast({ status: "error", title: "Error", description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Heading size="md" mb={5} color="purple.600">
        Create Checkout Link
      </Heading>
      <Divider mb={5} />

      <Stack spacing={4}>
        <FormControl>
          <FormLabel>Email</FormLabel>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Country</FormLabel>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Plan</FormLabel>
          <Select value={plan} onChange={(e) => setPlan(e.target.value as PaidSubscriptionPlan)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <Checkbox isChecked={sendInEmail} onChange={(e) => setSendInEmail(e.target.checked)}>
          Send link in email
        </Checkbox>

        <Button
          colorScheme="purple"
          onClick={handleSubmit}
          isLoading={isProcessing}
          loadingText="Creating..."
        >
          Get PayStack Checkout Link
        </Button>

        {checkoutUrl && (
          <Box mt={4} p={3} bg="gray.50" borderRadius="md">
            <Text mb={2} fontWeight="medium">
              Checkout URL:
            </Text>
            <Stack direction="row">
              <Input value={checkoutUrl} isReadOnly bg="white" />
              <Button onClick={onCopy}>{hasCopied ? "Copied!" : "Copy"}</Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </>
  );
}
