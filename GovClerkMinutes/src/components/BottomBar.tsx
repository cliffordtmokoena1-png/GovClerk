import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import { Flex, Icon, Box, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { HiHome, HiMicrophone, HiPlusCircle, HiDocumentDuplicate, HiUser } from "react-icons/hi2";
import { BOTTOM_BAR_HEIGHT } from "@/constants/layout";

export const BOTTOM_BAR_HEIGHT_PX = BOTTOM_BAR_HEIGHT;

type Props = {
  layoutKind: LayoutKind;
  onLayoutChange: (layout: LayoutKind) => void;
};

type NavItem = {
  id: LayoutKind;
  icon: typeof HiHome;
  label: string;
};

const navItems: NavItem[] = [
  { id: "home", icon: HiHome, label: "Home" },
  { id: "recordings", icon: HiMicrophone, label: "Recordings" },
  { id: "new-meeting", icon: HiPlusCircle, label: "New" },
  { id: "templates", icon: HiDocumentDuplicate, label: "Templates" },
  { id: "account", icon: HiUser, label: "Account" },
];

export default function BottomBar({ layoutKind, onLayoutChange }: Props) {
  const router = useRouter();

  const handleNavClick = (viewId: LayoutKind) => {
    if (viewId === "home" || viewId === "new-meeting") {
      router.push("/dashboard");
    }
    onLayoutChange(viewId);
  };

  const isActive = (viewId: LayoutKind): boolean => {
    if (viewId === "home") {
      return layoutKind === "home" || layoutKind === "past-meetings";
    }
    if (viewId === "new-meeting") {
      return (
        layoutKind === "new-meeting" ||
        layoutKind === "dashboard-transcript" ||
        layoutKind === "dashboard-minutes"
      );
    }
    return layoutKind === viewId;
  };

  return (
    <Flex
      as="nav"
      w="100%"
      h={`${BOTTOM_BAR_HEIGHT}px`}
      bg="white"
      borderTop="1px solid"
      borderColor="gray.200"
      justifyContent="space-around"
      alignItems="center"
      position="relative"
      userSelect="none"
      boxShadow="0 -2px 10px rgba(0, 0, 0, 0.05)"
      zIndex={10}
    >
      {navItems.map((item) => {
        const active = isActive(item.id);
        const isNewButton = item.id === "new-meeting";

        return (
          <Flex
            key={item.id}
            as="button"
            direction="column"
            align="center"
            justify="center"
            flex={1}
            h="full"
            position="relative"
            onClick={() => handleNavClick(item.id)}
            cursor="pointer"
            transition="all 0.2s ease"
            _active={{ transform: "scale(0.95)" }}
            aria-label={item.label}
            role="tab"
            aria-selected={active}
          >
            {isNewButton ? (
              <>
                <Box
                  position="relative"
                  bg="blue.500"
                  borderRadius="xl"
                  w="48px"
                  h="48px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 4px 12px rgba(59, 130, 246, 0.4)"
                  transition="all 0.2s ease"
                  _active={{
                    transform: "scale(0.9)",
                    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <Icon as={item.icon} boxSize={7} color="white" />
                </Box>
                <Text fontSize="xs" fontWeight="medium" color="blue.500" mt={1}>
                  {item.label}
                </Text>
              </>
            ) : (
              <>
                <Box
                  position="relative"
                  bg={active ? "blue.50" : "transparent"}
                  borderRadius="xl"
                  w="48px"
                  h="48px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  transition="all 0.2s ease"
                >
                  <Icon
                    as={item.icon}
                    boxSize={6}
                    color={active ? "blue.500" : "gray.500"}
                    transition="all 0.2s ease"
                  />
                </Box>
                <Text
                  fontSize="xs"
                  fontWeight="medium"
                  color={active ? "blue.500" : "gray.600"}
                  mt={1}
                  transition="all 0.2s ease"
                >
                  {item.label}
                </Text>
              </>
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}
