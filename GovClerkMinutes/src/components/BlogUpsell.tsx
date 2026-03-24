import { Text, Button, Flex, Link } from "@chakra-ui/react";
import { BsArrowRight } from "react-icons/bs";

const BlogUpsell = () => {
  return (
    <Flex
      w="full"
      gap={{ base: 4, lg: 8 }}
      alignItems="center"
      px={{ base: 4, sm: 6, lg: 8 }}
      justifyContent="center"
      py={4}
    >
      <Text fontSize={{ base: "mg", md: "lg", lg: "xl" }} fontWeight="semibold">
        Get started with 40 minutes of free transcription
      </Text>
      <Link href="/sign-up">
        <Button
          colorScheme="messenger"
          size={{ base: "sm", lg: "lg" }}
          rightIcon={<BsArrowRight />}
        >
          Start for free
        </Button>
      </Link>
    </Flex>
  );
};

export default BlogUpsell;
