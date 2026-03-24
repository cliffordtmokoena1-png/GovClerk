import {
  getPriceUnit,
  isPlanProratable,
  SubscriptionPlan,
  isPlanAnnual,
  getPrice,
  getPriceId,
  getPlanForBillingPeriod,
  BillingPeriod,
  getBillingPeriod,
  formatPrice,
} from "@/utils/price";

import {
  Button,
  Flex,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  UnorderedList,
} from "@chakra-ui/react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { revalidateCustomerDetails } from "@/revalidations/revalidateCustomerDetails";
import { useUser } from "@clerk/nextjs";

type Props = {
  transcriptId?: number;
  country?: string;
  planName: SubscriptionPlan;
  isOpen: boolean;
  onClose: () => void;
};
export default function UpgradePlanConfirmModal({
  transcriptId,
  country,
  planName,
  isOpen,
  onClose,
}: Props) {
  const { user } = useUser();

  const currentBillingPeriod = getBillingPeriod(planName);
  const targetPlan = getPlanForBillingPeriod("Pro", currentBillingPeriod);
  const targetPrice = getPrice(country, targetPlan);

  const { data } = useSWR(
    country == null || !isPlanProratable(planName) ? null : "/api/get-upgrade-prorated-cost",
    async (uri) => {
      return await fetch(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country,
          targetPlan,
        }),
      }).then((res) => res.json());
    }
  );

  const { trigger, isMutating } = useSWRMutation("/api/upgrade-plan", async () => {
    return await fetch("/api/upgrade-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        country,
        targetPlan,
      }),
    }).then((res) => res.json());
  });

  return (
    <>
      <Modal onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm your upgrade</ModalHeader>
          <ModalCloseButton />
          <ModalBody mb={6}>
            {data != null && !isMutating ? (
              <Flex flexDir="column">
                <UnorderedList spacing={3}>
                  <ListItem>You will receive 1200 tokens per month</ListItem>
                  <ListItem>
                    You will be charged {getPriceUnit(country)}
                    {formatPrice(Math.max(data.proratedCost / 100, 0))}
                  </ListItem>
                  <ListItem>
                    Your new {currentBillingPeriod === BillingPeriod.Yearly ? "year" : "month"}ly
                    bill will be {getPriceUnit(country)}
                    {formatPrice(targetPrice)} per{" "}
                    {currentBillingPeriod === BillingPeriod.Yearly ? "year" : "month"}
                  </ListItem>
                  <Flex justifyContent="center" alignItems="center" pt={3}>
                    <Button
                      size="lg"
                      colorScheme="orange"
                      onClick={async () => {
                        try {
                          await trigger();
                          setTimeout(() => {
                            revalidateCustomerDetails(transcriptId, user!.id);
                          }, 5000);
                        } finally {
                          onClose();
                        }
                      }}
                    >
                      Upgrade now
                    </Button>
                  </Flex>
                </UnorderedList>
              </Flex>
            ) : (
              <Flex justifyContent="center">
                <Spinner />
              </Flex>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
