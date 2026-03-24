import React, { useState, useEffect, useCallback } from "react";
import { Flex, Heading, useDisclosure, VStack, Divider } from "@chakra-ui/react";
import { toast } from "sonner";
import { UserProfile } from "@clerk/nextjs";
import { MdOutlinePayment, MdOutlineAlternateEmail, MdSettings, MdGroup } from "react-icons/md";
import PauseSubscriptionModal from "@/components/PauseSubscriptionModal";
import ResubscribeModal from "@/components/ResubscribeModal";
import CreditDetailsModal from "@/components/CreditDetailsModal";
import SubscriptionInfo from "@/components/SubscriptionInfo";
import UsageDetails from "@/components/UsageDetails";
import PaymentInfo from "@/components/PaymentInfo";
import GeneralSettings from "@/components/profile/GeneralSettings";
import { isDev } from "@/utils/dev";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { safeCapture } from "@/utils/safePosthog";
import { getPrice, getPriceUnit, SubscriptionPlan } from "@/utils/price";
import {
  isSubscriptionActive,
  isSubscriptionPaused,
  isSubscriptionCanceled,
  calculateUsage,
  calculateDaysUntilCreditReset,
  isSubscriptionDelinquent,
} from "@/utils/subscription";
import { CreditDetail } from "@/types/subscription";
import { useOrgContext } from "@/contexts/OrgContext";

interface AccountContentProps {
  readonly initialSubscriptionData: ApiGetCustomerDetailsResponse;
}

export function AccountContent({ initialSubscriptionData }: Readonly<AccountContentProps>) {
  const { orgId, mode, orgName } = useOrgContext();
  const {
    isOpen: isPauseModalOpen,
    onOpen: onPauseModalOpen,
    onClose: onPauseModalClose,
  } = useDisclosure();
  const {
    isOpen: isResubscribeModalOpen,
    onOpen: onResubscribeModalOpen,
    onClose: onResubscribeModalClose,
  } = useDisclosure();
  const {
    isOpen: isCreditDetailsModalOpen,
    onOpen: onCreditDetailsModalOpen,
    onClose: onCreditDetailsModalClose,
  } = useDisclosure();
  const [subscriptionData, setSubscriptionData] =
    useState<ApiGetCustomerDetailsResponse>(initialSubscriptionData);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [tokenDetails, setCreditDetails] = useState<CreditDetail[]>([]);
  const [isLoadingCreditDetails, setIsLoadingCreditDetails] = useState(false);

  const fetchSubscriptionData = useCallback(async () => {
    try {
      const response = await fetch("/api/get-customer-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      });
      if (!response.ok) {
        throw new Error("Failed to get subscription status");
      }
      const data = await response.json();
      setSubscriptionData(data);
    } catch (error) {
      console.error("Error checking subscription status:", error);
      toast.error("Failed to update subscription status. Please refresh the page.");
    }
  }, [orgId]);

  const fetchCreditDetails = async () => {
    setIsLoadingCreditDetails(true);
    try {
      const response = await fetch("/api/get-token-details");
      if (!response.ok) {
        throw new Error("Failed to get token details");
      }
      const data = await response.json();
      setCreditDetails(data);
      onCreditDetailsModalOpen();
    } catch (error) {
      console.error("Error fetching token details:", error);
      toast.error("Failed to fetch token details. Please try again.");
    } finally {
      setIsLoadingCreditDetails(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const handleRenewSubscription = async () => {
    onResubscribeModalClose();
    setIsRenewing(true);
    try {
      const response = await fetch("/api/resume-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to renew subscription");
      }

      const data = await response.json() as { url?: string; success?: boolean };
      if (data.url) {
        // PayStack needs a new checkout — redirect the user
        window.location.href = data.url;
        return;
      }

      await fetchSubscriptionData();
      toast.success("Your subscription has been renewed successfully.");
    } catch (error) {
      console.error("Error renewing subscription:", error);
      toast.error("Failed to renew subscription. Please try again.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleDevCancel = async () => {
    setIsTerminating(true);
    try {
      const response = await fetch("/api/dev-cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }

      await fetchSubscriptionData();
      toast.success("Your subscription has been canceled immediately.");
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Failed to cancel subscription. Please try again.");
    } finally {
      setIsTerminating(false);
    }
  };

  const handlePauseClick = () => {
    safeCapture("billing_subscription_pause_started");
    onPauseModalOpen();
  };

  const handleResubscribeClick = () => {
    onResubscribeModalOpen();
  };

  const subscriptionActive = isSubscriptionActive(subscriptionData.subscriptionStatus);
  const subscriptionPaused = isSubscriptionPaused(subscriptionData.subscriptionStatus);
  const subscriptionCanceled = isSubscriptionCanceled(subscriptionData.subscriptionStatus);
  const subscriptionDelinquent = isSubscriptionDelinquent(subscriptionData.subscriptionStatus);
  const isFreeUser = subscriptionData.isFreeUser;
  const showDevTerminateButton = isDev() && (subscriptionActive || subscriptionPaused);
  const planName: SubscriptionPlan = subscriptionData.planName || "Free";
  const price = getPrice(subscriptionData.country, planName === "Free" ? "Basic" : planName);
  const priceUnit = getPriceUnit(subscriptionData.country);

  const { currentUsage, tokenUsagePercentage, excessToken, hasExcessToken } =
    calculateUsage(subscriptionData);
  const daysUntilReset = calculateDaysUntilCreditReset(subscriptionData);

  return (
    <>
      <Flex alignItems="center" justifyContent="center" h="full" w="full">
        <UserProfile
          routing="path"
          path="/a/account"
          appearance={{
            elements: {
              cardBox: {
                height: "100%",
                width: "100%",
                boxSizing: "border-box",
                margin: 0,
                padding: 0,
                maxWidth: "100%",
                maxHeight: "100%",
                boxShadow: "none",
                border: "none",
              },
              rootBox: {
                height: "100%",
                width: "100%",
              },
              card: {
                height: "100%",
                width: "100%",
                boxShadow: "none",
                border: "none",
              },
              navbar: {
                width: "100%",
                maxWidth: "100%",
              },
              navbarButtons: {
                width: "100%",
                maxWidth: "100%",
              },
            },
          }}
        >
          <UserProfile.Page label="account" />
          <UserProfile.Page label="security" />
          <UserProfile.Page label="General" labelIcon={<MdSettings size={16} />} url="general">
            <GeneralSettings />
          </UserProfile.Page>
          <UserProfile.Page
            label="Billing"
            labelIcon={<MdOutlinePayment size={16} />}
            url="billing"
          >
            <VStack spacing={6} align="stretch" w="full" maxW="600px" mx="auto" p={4}>
              <Heading size="lg">
                {mode === "org" ? `${orgName} Subscription` : "Your Personal Subscription"}
              </Heading>

              <SubscriptionInfo
                subscriptionData={subscriptionData}
                subscriptionActive={subscriptionActive}
                subscriptionPaused={subscriptionPaused}
                subscriptionCanceled={subscriptionCanceled}
                subscriptionDelinquent={subscriptionDelinquent}
                isFreeUser={isFreeUser}
                planName={planName}
                price={price}
                priceUnit={priceUnit}
                isRenewing={isRenewing}
                handlePauseClick={handlePauseClick}
                handleResubscribeClick={handleResubscribeClick}
                billingContext={
                  mode === "org"
                    ? { type: "organization", orgName: orgName || undefined }
                    : { type: "personal" }
                }
              />

              <Divider />

              <Heading size="md">Usage</Heading>

              <UsageDetails
                subscriptionData={subscriptionData}
                subscriptionPaused={subscriptionPaused}
                subscriptionCanceled={subscriptionCanceled}
                isFreeUser={isFreeUser}
                currentUsage={currentUsage}
                tokenUsagePercentage={tokenUsagePercentage}
                excessToken={excessToken}
                hasExcessToken={hasExcessToken}
                daysUntilReset={daysUntilReset}
                isLoadingCreditDetails={isLoadingCreditDetails}
                fetchCreditDetails={fetchCreditDetails}
              />

              <Divider />

              <Heading size="md">Payment</Heading>

              <PaymentInfo
                subscriptionData={subscriptionData}
                subscriptionActive={subscriptionActive}
                subscriptionPaused={subscriptionPaused}
                price={price}
                priceUnit={priceUnit}
                showDevTerminateButton={showDevTerminateButton}
                isTerminating={isTerminating}
                handleDevCancel={handleDevCancel}
              />
            </VStack>
          </UserProfile.Page>
          {mode === "org" && (
            <UserProfile.Link
              label="Organization"
              labelIcon={<MdGroup size={16} />}
              url="/a/organization"
            />
          )}
          <UserProfile.Link
            label="Get Help"
            labelIcon={<MdOutlineAlternateEmail size={16} />}
            url="mailto:cliff@govclerkminutes.com"
          />
        </UserProfile>
      </Flex>
      <PauseSubscriptionModal
        isOpen={isPauseModalOpen}
        onClose={onPauseModalClose}
        onSuccess={fetchSubscriptionData}
      />
      <ResubscribeModal
        isOpen={isResubscribeModalOpen}
        onClose={onResubscribeModalClose}
        onConfirm={handleRenewSubscription}
        planName={planName}
        tokensPerMonth={subscriptionData.tokensPerMonth}
        price={price.toString()}
        priceUnit={priceUnit}
        nextBillDate={subscriptionData.nextBillDate}
        subscriptionData={subscriptionData}
      />
      <CreditDetailsModal
        isOpen={isCreditDetailsModalOpen}
        onClose={onCreditDetailsModalClose}
        tokenDetails={tokenDetails}
      />
    </>
  );
}

export default AccountContent;
