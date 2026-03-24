import { useAuth } from "@clerk/nextjs";
import { useOrgContext } from "@/contexts/OrgContext";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useOrgAppBarTitle } from "../context/OrgAppBarContext";
import { usePortalSettings } from "@/hooks/portal";
import { MeetingsTab } from "@/components/portal/manage";
import { ContentSpinner } from "./ContentSpinner";

export function MeetingsContent() {
  const { isLoaded } = useAuth();
  const { mode, orgId } = useOrgContext();
  const { settings, isLoading: isLoadingSettings } = usePortalSettings();

  // Set the app bar title to "Meetings" and reset on unmount
  useOrgAppBarTitle("Meetings", true);

  if (!isLoaded) {
    return (
      <Flex alignItems="center" justifyContent="center" h="full" w="full">
        <Spinner size="lg" color="blue.500" />
      </Flex>
    );
  }

  if (mode !== "org") {
    return (
      <Flex alignItems="center" justifyContent="center" h="full" w="full" p={8}>
        <Text color="gray.600" textAlign="center">
          Meetings management is only available for organizations. Please switch to an organization
          to access this feature.
        </Text>
      </Flex>
    );
  }

  if (isLoadingSettings) {
    return <ContentSpinner message="Loading meetings..." />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 max-w-5xl mx-auto">
      <div className="flex-1 overflow-hidden">
        <MeetingsTab hasPortalSettings={!!settings} />
      </div>
    </div>
  );
}

export default MeetingsContent;
