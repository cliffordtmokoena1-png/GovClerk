import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { isPaidSubscriptionPlan } from "@/utils/price";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { getAuth } from "@clerk/nextjs/server";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (context) => {
  const { country } = context.params as { country: string };
  const { plan } = context.query as { plan?: string };

  if (!plan || (!isPaidSubscriptionPlan(plan) && plan !== "Lite")) {
    return {
      props: {
        problem: `Invalid or missing plan: ${plan ?? "(none)"}`,
      },
    };
  }

  const { userId } = getAuth(context.req);

  if (!userId) {
    return {
      redirect: {
        destination: `/sign-in?redirect=/subscribe/${country}?plan=${plan}`,
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: `/subscribe/${country}/${plan}/${userId}`,
      permanent: false,
    },
  };
});

type Props = {
  problem?: string;
};

export default function SubscribeCountryPage({ problem }: Props) {
  return (
    <Flex direction="column" align="center" justify="center" minHeight="100vh">
      {problem ? <Text color="red.500">{problem}</Text> : <Spinner />}
    </Flex>
  );
}
