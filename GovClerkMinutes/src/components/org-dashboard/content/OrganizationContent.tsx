import React from "react";
import { Flex } from "@chakra-ui/react";
import { OrganizationProfile } from "@clerk/nextjs";
import { MdArrowBack } from "react-icons/md";

export function OrganizationContent() {
  return (
    <Flex alignItems="center" justifyContent="center" h="full" w="full">
      <OrganizationProfile
        routing="path"
        path="/a/organization"
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
  );
}

export default OrganizationContent;
