import { Flex, Text } from "@chakra-ui/react";
import Image from "next/image";
import StarSvg from "./StarSvg";
import HeroCallToAction from "./HeroCallToAction";
import ArrowSvg2 from "./ArrowSvg2";
import { LandingHeadline2 } from "./LandingHeadline";

const ACCOLADE_WIDTH = { base: "45%", sm: "30%", lg: "30%" };

const HEADER_VARIANTS = ["control", "test1", "test2"] as const;
type HeaderVariant = (typeof HEADER_VARIANTS)[number];

type Props = {
  fromFbAd: boolean;
  landingPageHeaderVariant: HeaderVariant;
  emailSubmitted: boolean;
  onEmailSubmitted: () => void;
};
const LandingHeader = ({
  fromFbAd,
  landingPageHeaderVariant,
  emailSubmitted,
  onEmailSubmitted,
}: Props) => {
  return (
    <Flex
      direction={{ base: "column", lg: "row" }}
      px={{ base: 1, sm: 4, lg: 8 }}
      pt={{ base: 6, lg: 10 }}
      pb={{ base: 2, lg: 5 }}
      maxW="7xl"
      alignItems="center"
      gap={{ base: 2, lg: 4 }}
    >
      <Flex
        direction="column"
        alignItems={{ base: "center", lg: "start" }}
        gap={{ base: 4, lg: 8 }}
      >
        <LandingHeadline2 />
        <Flex display={{ base: "none", sm: "flex" }}>
          <Text
            w={{ base: "xs", sm: "lg" }}
            fontSize={{ base: "md", sm: "lg" }}
            fontWeight="semibold"
          >
            Upload a meeting recording and get a high quality transcript and summary.
          </Text>
        </Flex>
        <Flex
          w="full"
          flexDir="row"
          mb={{ base: 0, lg: 16, xl: 8 }}
          ml={{ base: 0, md: 4, lg: 10 }}
          justifyContent={{ base: "center", lg: "start" }}
          gap={{ base: 2, sm: 6, md: 16, lg: 6 }}
        >
          <Flex w={ACCOLADE_WIDTH}>
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">
                6,000+ professionals
              </Text>{" "}
              automate writing meeting minutes with us
            </Text>
          </Flex>
          <Flex
            justifyContent="center"
            alignItems="center"
            w={ACCOLADE_WIDTH}
            flexDir="column"
            textAlign="center"
            gap={1}
          >
            <Text fontSize="sm" fontStyle="italic">
              We make writing minutes{" "}
              <Text as="span" fontWeight="bold">
                fast, easy, and automatic
              </Text>
            </Text>

            <Flex>
              <Flex w={6} h={6}>
                <StarSvg />
              </Flex>
              <Flex w={6} ml={-1} h={6}>
                <StarSvg />
              </Flex>
              <Flex w={6} ml={-1} h={6}>
                <StarSvg />
              </Flex>
              <Flex w={6} ml={-1} h={6}>
                <StarSvg />
              </Flex>
              <Flex w={6} ml={-1} h={6}>
                <StarSvg />
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
      <Flex
        direction="column"
        boxShadow="dark-lg"
        borderRadius="md"
        maxW="2xl"
        display={{ base: "none", lg: "flex" }}
        zIndex={-100}
      >
        <Image
          style={{ borderRadius: "0.375rem" }}
          src="/landing-header3.jpg"
          alt="Screenshot of the product's transcript feature"
          quality={100}
          width={817}
          height={542}
          priority
        />
      </Flex>
      <Flex
        display={{ base: "flex", lg: "none" }}
        flexDir="column"
        maxW="lg"
        gap={{ base: 3, sm: 6 }}
      >
        <Flex display={{ base: "flex", lg: "none" }} justifyContent="center">
          <HeroCallToAction
            fromFbAd={fromFbAd}
            emailSubmitted={emailSubmitted}
            onEmailSubmitted={onEmailSubmitted}
          />
        </Flex>
        <Flex direction="column" boxShadow="dark-lg" borderRadius="md" maxW="2xl">
          <Image
            style={{ borderRadius: "0.375rem" }}
            src="/landing-header9.png"
            alt="Screenshot of the product's transcript feature"
            quality={100}
            width={697}
            height={518}
            priority
          />
        </Flex>
        <Flex alignItems="center" justifyContent="center">
          <Flex
            w={{ base: "60px", sm: "80px" }}
            h={{ base: "60px", sm: "80px" }}
            alignSelf="center"
          >
            <ArrowSvg2 rotationDegrees={150} scaleX={-1} scaleY={0.8} />
          </Flex>
          <Text fontStyle="italic" fontSize={{ base: "sm", sm: "md" }}>
            Transforms into...
          </Text>
        </Flex>
        <Flex direction="column" boxShadow="dark-lg" borderRadius="md" maxW="2xl">
          <Image
            style={{ borderRadius: "0.375rem" }}
            src="/landing-header10.png"
            alt="Screenshot of the product's meeting minutes feature"
            quality={100}
            width={728}
            height={515}
            priority
          />
        </Flex>
        <Flex
          pt={{ base: 4, sm: 10 }}
          display={{ base: "flex", lg: "none" }}
          alignItems="center"
          justifyContent="center"
        >
          <HeroCallToAction
            fromFbAd={fromFbAd}
            emailSubmitted={emailSubmitted}
            onEmailSubmitted={onEmailSubmitted}
          />
        </Flex>
      </Flex>
    </Flex>
  );
};

export default LandingHeader;
