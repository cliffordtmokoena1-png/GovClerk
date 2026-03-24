import React from "react";
import { Grid, GridItem, Text, useToast, HStack, Link, Icon } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import useSWR from "swr";
import type { Conversation } from "@/admin/whatsapp/types";

type ItemProps = {
  label: string;
  value?: string;
};

function ProspectInfoItem({ label, value }: ItemProps) {
  if (!value) {
    return null;
  }

  return (
    <>
      <GridItem colStart={1}>
        <Text color="gray.500" fontSize="sm">
          {label}
        </Text>
      </GridItem>
      <GridItem colStart={2}>
        <CopyableText value={value} />
      </GridItem>
    </>
  );
}

type Props = {
  conversation: Conversation;
};

function CopyableText({ value }: { value: string }) {
  const toast = useToast();
  return (
    <Text
      fontWeight="medium"
      fontSize="sm"
      cursor="pointer"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast({ title: "Copied", description: value, status: "success", duration: 1500 });
        } catch {
          toast({ title: "Copy failed", status: "error", duration: 1500 });
        }
      }}
      _hover={{ textDecoration: "underline" }}
    >
      {value}
    </Text>
  );
}

export default function ProspectInfoDetails({ conversation }: Props) {
  const { leadName, whatsappId, email, userId, frequency, dueDate } = conversation;

  const formattedPhone = whatsappId ? `+${whatsappId}` : undefined;
  const formattedDue = dueDate?.split(" ")[0];

  const { data: hubspotRes } = useSWR<{ url: string | null }>(
    whatsappId ? ["/api/admin/get-hubspot-url", whatsappId, email] : null,
    async (_key) => {
      return await fetch("/api/admin/get-hubspot-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, phone: formattedPhone }),
      }).then((res) => res.json());
    },
    {
      revalidateOnMount: true,
    }
  );

  return (
    <Grid templateColumns="max-content 1fr" columnGap={4} rowGap={2} alignItems="start">
      <ProspectInfoItem label="Name" value={leadName} />
      <ProspectInfoItem label="Email" value={email} />
      <ProspectInfoItem label="Phone" value={formattedPhone} />
      <ProspectInfoItem label="Frequency" value={frequency} />
      <ProspectInfoItem label="Due Date" value={formattedDue} />
      <ProspectInfoItem label="UserId" value={userId} />
      {hubspotRes ? (
        <>
          <GridItem colStart={1}>
            <Text color="gray.500" fontSize="sm">
              HubSpot
            </Text>
          </GridItem>
          <GridItem colStart={2}>
            <HStack spacing={1} align="center">
              {hubspotRes.url ? (
                <>
                  <Link href={hubspotRes.url} isExternal color="blue.500" fontSize="sm">
                    Open contact
                  </Link>
                  <Icon as={ExternalLinkIcon} color="blue.500" />
                </>
              ) : (
                <Text fontSize="sm">No contact found</Text>
              )}
            </HStack>
          </GridItem>
        </>
      ) : null}
    </Grid>
  );
}
