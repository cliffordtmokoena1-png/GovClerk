import EmailForm from "@/components/EmailForm";
import IconWordmark from "@/components/IconWordmark";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import isFbIg from "@/utils/isFbIg";
import isMobile from "@/utils/isMobile";
import { Flex, Spinner } from "@chakra-ui/react";
import { SignUp, useAuth, useUser } from "@clerk/nextjs";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (context) => {
  const userAgent = context.req.headers["user-agent"] || "";

  return {
    props: {
      isFbIg: isFbIg(userAgent),
      isMobile: isMobile(context.req.headers),
    },
  };
});

type Props = {
  isFbIg: boolean;
  isMobile: boolean;
};

export default function SignUpPage({ isFbIg, isMobile }: Props) {
  const router = useRouter();
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const { isSignedIn, isLoaded } = useUser();
  const { sessionClaims } = useAuth();

  useEffect(() => {
    // Only redirect when the session is fully active (matching sign-in page behaviour).
    // A "pending" session (sts !== "active") means Clerk still has tasks to complete
    // (e.g. OAuth consent, org selection) — redirecting early causes a loading loop
    // on mobile with Google OAuth.
    if (isLoaded && isSignedIn && sessionClaims?.sts === "active") {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, sessionClaims, router]);

  if (!isLoaded) {
    return (
      <Flex minH="100dvh" justifyContent="center" alignItems="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  const redirectUrl = "/dashboard";

  return (
    <Flex
      direction="column"
      maxH="100dvh"
      minH="100dvh"
      justifyContent="center"
      alignItems="center"
    >
      {isFbIg ? (
        <Flex flexDir="column" w="80%" gap={10} justifyContent="center">
          <IconWordmark />
          <EmailForm submitted={emailSubmitted} onSubmit={() => setEmailSubmitted(true)} />
        </Flex>
      ) : (
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl={redirectUrl}
          afterSignUpUrl="/dashboard"
          afterSignInUrl="/dashboard"
        />
      )}
    </Flex>
  );
}
