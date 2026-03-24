import { Button, Flex } from "@chakra-ui/react";
import Link from "next/link";
import { FaArrowRightLong } from "react-icons/fa6";
import EmailForm from "./EmailForm";

type Props = {
  fromFbAd: boolean;
  emailSubmitted: boolean;
  onEmailSubmitted: () => void;
};
export default function HeroCallToAction({ emailSubmitted, fromFbAd, onEmailSubmitted }: Props) {
  return (
    <Flex w="80%" justifyContent="center" pb={6} pt={3}>
      <Flex direction="column" alignItems="center" gap={6}>
        <EmailForm
          submitted={emailSubmitted}
          hideBottomText={fromFbAd}
          onSubmit={onEmailSubmitted}
        />
        {/* <Link href="/sign-up">
            <Button
              type="submit"
              colorScheme="orange"
              size="lg"
              rightIcon={
                <Flex mt={1} ml={2}>
                  <FaArrowRightLong />
                </Flex>
              }
              fontWeight="bold"
            >
              {fromFbAd ? "Send me instructions" : "Try for free"}
            </Button>
          </Link> */}
      </Flex>
    </Flex>
  );
}
