import React from "react";
import Head from "next/head";
import { Flex } from "@chakra-ui/react";
import { OrganizationProfile } from "@clerk/nextjs";
import { MdArrowBack } from "react-icons/md";
import { GetServerSideProps } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { useOrgContext } from "@/contexts/OrgContext";

export default function OrganizationProfilePage() {
  const { orgName } = useOrgContext();

  return (
    <>
      <Head>
        <title>{orgName ? `${orgName} Organization` : "Organization"} - GovClerkMinutes</title>
        <meta
          name="description"
          content="Manage your organization settings, members, and billing information"
        />
        <meta property="og:title" content="Organization Management - GovClerkMinutes" />
        <meta
          property="og:description"
          content="Manage your GovClerkMinutes organization details"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Flex alignItems="center" justifyContent="center" h="100dvh" w="full">
        <OrganizationProfile
          appearance={{
            elements: {
              cardBox: {
                height: "100dvh",
                width: "100dvw",
                boxSizing: "border-box",
                margin: 0,
                padding: 0,
                maxWidth: "100%",
                maxHeight: "100%",
              },
              rootBox: {
                height: "100dvh",
                width: "100dvw",
              },
              card: {
                height: "100dvh",
                width: "100dvw",
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
          afterLeaveOrganizationUrl="/dashboard"
        >
          <OrganizationProfile.Page label="general" />
          <OrganizationProfile.Page label="members" />

          <OrganizationProfile.Link
            label="Go Back"
            labelIcon={<MdArrowBack size={16} />}
            url="/a/account"
          />
        </OrganizationProfile>
      </Flex>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (context) => {
  const { userId, orgId } = getAuth(context.req);

  if (!userId) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  if (!orgId) {
    return {
      redirect: {
        destination: "/profile",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
});
