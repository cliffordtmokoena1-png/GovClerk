import Image from "next/image";
import { Flex } from "@chakra-ui/react";

export type Props = {
  variant?: "whiteWordmark" | "blackWordmark";
};

export default function IconWordmark({ variant = "blackWordmark" }: Props) {
  return (
    <Flex w="full" justifyContent="flex-start" alignItems="center">
      <Image
        src={variant === "whiteWordmark" ? "/icon-wordmark-white.svg" : "/icon-wordmark.svg"}
        alt="GovClerkMinutes wordmark"
        width={200}
        height={40}
        priority
      />
    </Flex>
  );
}
