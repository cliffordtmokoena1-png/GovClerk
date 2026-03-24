import { useRouter } from "next/router";
import { Flex, Box, Heading, Spinner, Text } from "@chakra-ui/react";
import { AiFillCheckCircle } from "react-icons/ai";
import { useEffect } from "react";
import { NavBar } from "@/components/base/NavBar";
import { safeCapture } from "@/utils/safePosthog";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { transcribeSegments } from "../api/resume-transcribe";
import MgHead from "@/components/MgHead";
import { reportPurchaseConversion } from "@/google/conversion";
import { UploadKind } from "@/uploadKind/uploadKind";

type Props = {
  transcriptId: number | null;
  currency: string | null;
  purchaseAmount: number | null;
  checkoutId: string | null;
};

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  const { params } = context;
  const slug = params?.slug;
  const checkoutId = slug?.[0];

  if (typeof checkoutId !== "string") {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  const { userId } = getAuth(context.req);
  if (userId == null) {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: false,
      },
    };
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      `
      SELECT payments.transcript_id, transcripts.upload_kind, payments.currency, payments.purchase_amount 
      FROM payments 
      LEFT JOIN transcripts ON payments.transcript_id = transcripts.id
      WHERE payments.checkout_session_id = ?;
      `,
      [checkoutId]
    )
    .then((result) => result.rows);

  if (rows.length === 0) {
    return { props: { transcriptId: null, currency: null, purchaseAmount: null } };
  }

  const {
    transcript_id: transcriptId,
    upload_kind: uploadKind,
    currency,
    purchase_amount: purchaseAmount,
  } = rows[0] as {
    transcript_id: number;
    upload_kind: UploadKind;
    currency: string;
    purchase_amount: number;
  };

  if (transcriptId != null && uploadKind === "audio") {
    transcribeSegments(transcriptId);
  } else if (transcriptId != null) {
    // TODO: start streaming create-minutes
  }

  return { props: { transcriptId, currency, purchaseAmount, checkoutId } };
});

const CheckoutPage = ({ transcriptId, currency, purchaseAmount, checkoutId }: Props) => {
  const router = useRouter();

  useEffect(() => {
    safeCapture("user_purchase_browser", {
      transcript_id: transcriptId,
    });

    if (currency != null && purchaseAmount != null) {
      if (currency != null && purchaseAmount != null) {
        const value = purchaseAmount / 100.0;
        const upperCurrency = currency.toUpperCase();

        // Fire Google Ads conversion
        reportPurchaseConversion({
          value,
          currency: upperCurrency,
          transactionId: checkoutId ?? transcriptId?.toString(),
        });
      }
    }

    if (transcriptId == null) {
      router.push("/dashboard");
    } else {
      router.push(`/dashboard/${transcriptId}?purchased=true`);
    }
  }, [checkoutId, currency, purchaseAmount, router, transcriptId]);

  return (
    <>
      <MgHead noindex />
      <Flex flexDir="column" h="100dvh" w="full" position="relative">
        <NavBar fromFbAd={false} />
        <Flex flex="1" justifyContent="center" alignItems="center" px={4}>
          <Box maxW="xl" textAlign="center">
            <Flex justifyContent="center" alignItems="center" mb={6}>
              <AiFillCheckCircle color="green" size={35} />
              <Heading pl={3}>Your purchase is confirmed!</Heading>
            </Flex>
            <Spinner thickness="4px" emptyColor="gray.200" color="blue.500" size="xl" mx="auto" />
            <Text pt={5} fontSize="xl" fontWeight="semibold">
              You will be redirected to your transcript shortly...
            </Text>
          </Box>
        </Flex>
      </Flex>
    </>
  );
};

export default CheckoutPage;
