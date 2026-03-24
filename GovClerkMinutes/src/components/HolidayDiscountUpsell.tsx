import { Flex, Text } from "@chakra-ui/react";
import CountdownTimer from "./CountdownTimer";

type Props = {
  variant: "button" | "card";
};
export default function HolidayDiscountUpsell({ variant }: Props) {
  const variantStyles =
    variant === "button"
      ? {
          transition: "background-color 0.3s",
          "&:hover": {
            backgroundColor: "orange.300",
            cursor: "pointer",
          },

          position: "relative",
          overflow: "hidden",
          "&:before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent)",
            animation: "shimmer 6s infinite",
          },
          "@keyframes shimmer": {
            "0%": {
              transform: "translateX(-100%)",
            },
            "40%": {
              transform: "translateX(100%)",
            },
            "100%": {
              transform: "translateX(100%)",
            },
          },
        }
      : {};

  return (
    <Flex
      flexDir="column"
      alignSelf="center"
      w="full"
      bg="orange.200"
      p={2}
      borderRadius={variant === "button" ? 0 : 8}
      sx={variantStyles}
      onClick={() => {
        if (variant !== "button") {
          return;
        }
        const element = document.getElementById("holiday-discount");
        if (element) {
          window.scrollTo({
            top: element.offsetTop,
            behavior: "smooth",
          });
        }
      }}
    >
      <Text fontSize="md" textAlign="center" fontWeight="normal">
        <Text as="span" fontWeight="extrabold">
          Holiday discount ends in:
        </Text>
      </Text>
      <CountdownTimer targetDate={new Date("January 1, 2024 00:00:00")} />
      {variant === "button" && (
        <Text textAlign="center" fontSize="sm" pt={1}>
          Click{" "}
          <Text as="span" fontWeight="bold" textDecor="underline">
            here
          </Text>{" "}
          to learn more
        </Text>
      )}
    </Flex>
  );
}
