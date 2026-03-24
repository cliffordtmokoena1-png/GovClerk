import EmailForm from "@/components/EmailForm";
import IconWordmark from "@/components/IconWordmark";
import MgHead from "@/components/MgHead";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import isFbIg from "@/utils/isFbIg";
import isMobile from "@/utils/isMobile";
import { Flex } from "@chakra-ui/react";
import { SignUp, CreateOrganization, useUser, useOrganization } from "@clerk/nextjs";
import { GetServerSideProps } from "next";
import { useState } from "react";

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

export default function OrgSignUpPage({ isFbIg, isMobile }: Props) {
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const { isSignedIn, isLoaded } = useUser();
  const { isLoaded: isOrgLoaded } = useOrganization();

  if (!isLoaded || !isOrgLoaded) {
    return null;
  }

  const showOrgCreation = isSignedIn;

  return (
    <>
      <MgHead title="Create Organization - GovClerkMinutes" noindex />
      <Flex
        direction="column"
        maxH="100dvh"
        minH="100dvh"
        justifyContent="center"
        alignItems="center"
        position="relative"
        overflow="hidden"
      >
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bgGradient="linear(to-b, blue.100, white)"
          _after={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E\")",
            opacity: 0.5,
          }}
        />
        <Flex position="relative" zIndex={1}>
          {isFbIg ? (
            <Flex flexDir="column" w="80%" gap={10} justifyContent="center">
              <IconWordmark />
              <EmailForm submitted={emailSubmitted} onSubmit={() => setEmailSubmitted(true)} />
            </Flex>
          ) : showOrgCreation ? (
            <CreateOrganization
              afterCreateOrganizationUrl="/dashboard"
              skipInvitationScreen={false}
            />
          ) : (
            <SignUp
              path="/org/signup"
              routing="path"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/org/signup"
            />
          )}
        </Flex>
      </Flex>
    </>
  );
}
