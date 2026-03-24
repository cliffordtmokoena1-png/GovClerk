import { Flex, Text, Box } from "@chakra-ui/react";
import Image from "next/image";

const QUOTE =
  "I love it. I normally take 5 days to do minutes but with this it was done in just below an hour!  It's so professional, doesn't leave out important information.";

type Props = {};
export default function Testimonial({}: Props) {
  return (
    <Flex flexDir="column" alignItems="center" gap={6} px={2}>
      <Flex gap={3} alignItems="center" borderLeft="4px solid #CCC" pl={2}>
        <Text fontSize="xl" fontStyle="normal" textAlign="left" lineHeight="9">
          &quot;{QUOTE}&quot;
        </Text>
      </Flex>
      <Flex gap={3} alignSelf="start" alignItems="center">
        <Box boxSize={16} borderRadius="full" overflow="hidden">
          <Image
            src="/lucy.jpg"
            alt="Headshot of quote author"
            width={60}
            height={60}
            style={{ borderRadius: "50%" }}
            layout="responsive"
          />
        </Box>
        <Flex flexDir="column" alignItems="start" justifyContent="center">
          <Text fontSize="lg">Lucy M.</Text>
          <Text fontSize="lg">GovClerkMinutes customer</Text>
        </Flex>
      </Flex>
    </Flex>
  );
}
