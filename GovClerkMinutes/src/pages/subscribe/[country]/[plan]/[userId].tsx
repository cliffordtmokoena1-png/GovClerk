import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { createCheckoutSession } from "@/pages/api/create-checkout-session";
import getPrimaryEmail from "@/utils/email";
import { getClientReferenceId } from "@/utils/getClientReferenceId";
import { isPaidSubscriptionPlan, type PaidSubscriptionPlan } from "@/utils/price";
import { Text, Flex, Spinner } from "@chakra-ui/react";
import { getSiteFromRequest } from "@/utils/site";

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  const { country, plan, userId } = context.params as {
    country: string;
    plan: string;
    userId: string;
  };

  // Get the origin robustly (works on Vercel, local, etc)
  let origin: string;
  if (context.req.headers["x-forwarded-proto"] && context.req.headers.host) {
    origin = `${context.req.headers["x-forwarded-proto"]}://${context.req.headers.host}`;
  } else {
    origin = "http://localhost:3000";
  }

  // TODO: support Lite plan better
  if (!isPaidSubscriptionPlan(plan) && plan !== "Lite") {
    return {
      props: {
        problem: `Invalid plan: ${plan}`,
      },
    };
  }

  const site = getSiteFromRequest(context.req.headers);
  const email = await getPrimaryEmail(userId, site);
  if (email == null) {
    return {
      props: {
        problem: `User email not found for userId: ${userId}`,
      },
    };
  }

  // "Lite" is treated as Basic for PayStack plan mapping
  const resolvedPlan: PaidSubscriptionPlan =
    plan === "Lite" ? "Basic" : (plan as PaidSubscriptionPlan);

  const session = await createCheckoutSession({
    clientReferenceId: getClientReferenceId(undefined, userId),
    customerEmail: email,
    plan: resolvedPlan,
    country,
    mode: "subscription",
    successUrl: `${origin}/sign-in`,
    cancelUrl: `${origin}/sign-in`,
  });

  const url = session.url;
  if (url == null) {
    return {
      props: {
        problem: "Failed to create checkout session",
      },
    };
  }

  return {
    redirect: {
      destination: url,
      permanent: false,
    },
  };
});

type Props = {
  problem?: string;
};
export default function SubscriptionPage({ problem }: Props) {
  return (
    <Flex direction="column" align="center" justify="center" minHeight="100vh">
      {problem ? <Text color="red.500">{problem}</Text> : <Spinner />}
    </Flex>
  );
}
