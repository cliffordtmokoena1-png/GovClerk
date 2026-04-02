import EmailForm from "@/components/EmailForm";
import IconWordmark from "@/components/IconWordmark";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import isFbIg from "@/utils/isFbIg";
import { Flex, Text } from "@chakra-ui/react";
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (context) => {
  const userAgent = context.req.headers["user-agent"] || "";

  return {
    props: { isFbIg: isFbIg(userAgent) },
  };
});

type Props = {
  isFbIg: boolean;
};

export default function SignInPage({ isFbIg }: Props) {
  const router = useRouter();
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const { isSignedIn, isLoaded } = useUser();
  const { sessionClaims } = useAuth();

  // Support a ?redirect= query param so users coming from "Public Portal" links
  // are sent to the correct destination after signing in.
  const redirectParam = typeof router.query.redirect === "string" ? router.query.redirect : null;
  const redirectUrl =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/dashboard";

  useEffect(() => {
    // Only redirect when the session is fully active.
    // A "pending" session (sts !== "active") means the user still has
    // Clerk tasks to complete (e.g. choosing an organization), and
    // redirecting would cause an infinite loop.
    if (isLoaded && isSignedIn && sessionClaims?.sts === "active") {
      router.push(redirectUrl);
    }
  }, [isLoaded, isSignedIn, sessionClaims, router, redirectUrl]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Flex
      direction="column"
      minH="100dvh"
      maxH="100dvh"
      justifyContent="center"
      alignItems="center"
    >
      {isFbIg ? (
        <Flex flexDir="column" w="80%" gap={10} justifyContent="center">
          <IconWordmark />
          <EmailForm submitted={emailSubmitted} onSubmit={() => setEmailSubmitted(true)} />
        </Flex>
      ) : (
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={redirectUrl}
        />
      )}
    </Flex>
  );
}
