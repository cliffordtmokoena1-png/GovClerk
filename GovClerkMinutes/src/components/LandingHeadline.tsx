import { Heading, Text } from "@chakra-ui/react";

type Props = {};
export function LandingHeadline({}: Props) {
  return (
    <Heading
      as="h1"
      color="darkblue"
      size={{ base: "lg", sm: "xl" }}
      w={{ base: "full", sm: "lg" }}
    >
      Generate <Text as="span">meeting minutes</Text> from a recording{" "}
      <Text as="span" color="green.400">
        effortlessly
      </Text>
    </Heading>
  );
}

// Create meeting minutes in seconds, not hours.
type Props2 = {};
export function LandingHeadline2({}: Props2) {
  return (
    <Heading
      as="h1"
      color="darkblue"
      size={{ base: "xl", sm: "2xl" }}
      w={{ base: "full", sm: "lg" }}
      fontWeight="extrabold"
      style={{ lineHeight: "1.5" }}
      whiteSpace="nowrap"
    >
      Create meeting minutes
      <br />
      in seconds,{" "}
      <Text as="span" position="relative" whiteSpace="nowrap">
        <Text
          as="span"
          position="absolute"
          top={-1}
          right={-1}
          left={-1}
          bottom={-1}
          bg="blue.900"
          zIndex={-100}
          transform="translate(0px, 3px) rotate(-2deg) skewX(0deg) skewY(1deg) scaleX(1.0) scaleY(1.0)"
        ></Text>
        <Text as="span" color="white">
          not hours
        </Text>
      </Text>
    </Heading>
  );
}

// Create meeting minutes with one click.
type Props3 = {};
export function LandingHeadline3({}: Props3) {
  return (
    <Heading
      as="h1"
      color="darkblue"
      size={{ base: "xl", sm: "xl" }}
      w={{ base: "full", sm: "lg" }}
      fontWeight="extrabold"
      style={{ lineHeight: "1.5" }}
    >
      Create meeting minutes
      <br />
      with{" "}
      <Text as="span" color="green.400">
        one click.
      </Text>
    </Heading>
  );
}
