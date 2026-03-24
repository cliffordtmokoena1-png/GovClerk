import React from "react";
import { Link as ChakraLink, Image } from "@chakra-ui/react";

type Props = {
  width?: number | string;
};

export default function ElevenLabsLogo({ width = 150 }: Props) {
  return (
    <ChakraLink href="https://elevenlabs.io/text-to-speech" isExternal>
      <Image
        src="https://eleven-public-cdn.elevenlabs.io/payloadcms/pwsc4vchsqt-ElevenLabsGrants.webp"
        alt="Text to Speech"
        w={width}
        loading="lazy"
      />
    </ChakraLink>
  );
}
