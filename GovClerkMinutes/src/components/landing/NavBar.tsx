import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  IconButton,
  Link as ChakraLink,
  Text as ChakraText,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import Link from "next/link";
import IconWordmark from "@/components/IconWordmark";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import { HiArrowRight } from "react-icons/hi";
import { safeCapture } from "@/utils/safePosthog";
import { getPersonalizationFromCookies } from "@/utils/landing/landingUtils";
import { isDev } from "@/utils/dev";

const navLinkStyle = {
  fontSize: "sm",
  fontWeight: "medium",
  position: "relative" as const,
  transition: "color 0.2s",
  _hover: { color: "purple.500" },
  _before: {
    content: '""',
    position: "absolute" as const,
    bottom: "-2px",
    left: 0,
    right: 0,
    height: "2px",
    bg: "purple.500",
    transformOrigin: "right",
    transform: "scaleX(0)",
    transition: "transform 0.3s ease",
  },
  sx: { "&:hover::before": { transformOrigin: "left", transform: "scaleX(1)" } },
};

export const NavBar = () => {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [fromFbAd, setFromFbAd] = useState(false);

  const isOnBlogPage = router.pathname.startsWith("/blog");

  useEffect(() => {
    const { fromFbAd } = getPersonalizationFromCookies();
    setFromFbAd(fromFbAd);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const showEnterpriseLinks = isDev();

  const navLinks = [
    { label: "Features", href: isOnBlogPage ? "/#features" : "#features" },
    ...(showEnterpriseLinks ? [{ label: "Enterprise", href: "/enterprise" }] : []),
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
  ];

  return (
    <>
      <Box
        as="nav"
        position="fixed"
        top={isScrolled ? 4 : 0}
        left="50%"
        transform="translateX(-50%)"
        zIndex={100}
        w={isScrolled ? "95%" : "100%"}
        maxW="7xl"
        bg={isScrolled ? "rgba(255, 255, 255, 0.85)" : "transparent"}
        backdropFilter={isScrolled ? "blur(12px)" : "none"}
        borderRadius={isScrolled ? "2xl" : "0"}
        boxShadow={isScrolled ? "lg" : "none"}
        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <Container maxW="full" px={6}>
          <Flex h={14} alignItems="center" justify="space-between">
            <HStack spacing={8} color="black">
              <ChakraLink
                as={Link}
                href="/"
                display="flex"
                alignItems="center"
                gap={2}
                transition="transform 0.2s"
                _hover={{ transform: "scale(1.05)" }}
                mt="-1px"
              >
                <IconWordmark />
              </ChakraLink>

              <HStack spacing={8} display={{ base: "none", md: "flex" }}>
                {navLinks.map((link) => (
                  <ChakraLink key={link.href} as={Link} href={link.href} {...navLinkStyle}>
                    {link.label}
                  </ChakraLink>
                ))}
              </HStack>
            </HStack>

            <HStack spacing={4} display={{ base: "none", md: "flex" }}>
              {isLoaded && !userId ? (
                <>
                  <Button
                    as={Link}
                    href="/sign-in"
                    variant="ghost"
                    size="sm"
                    color="black"
                    transition="all 0.2s"
                    _hover={{
                      bg: "blackAlpha.200",
                    }}
                    onClick={() => safeCapture("navbar_sign_in_clicked", { variant: "v2" })}
                  >
                    Sign In
                  </Button>
                  <Button
                    as={Link}
                    href="/pricing"
                    size="sm"
                    bg="white"
                    color="blue.500"
                    border="1px solid"
                    borderColor="blue.500"
                    transition="all 0.2s"
                    _hover={{
                      bg: "blue.50",
                    }}
                    onClick={() =>
                      safeCapture("request_pricing_clicked", {
                        variant: "v2",
                        location: "navbar_desktop",
                      })
                    }
                  >
                    Request Pricing
                  </Button>
                  <Button
                    as={Link}
                    href="/demo"
                    bg="#E65A2E"
                    color="white"
                    size="sm"
                    transition="all 0.2s"
                    _hover={{
                      bg: "#D54C21",
                      boxShadow: "md",
                    }}
                    onClick={() => {
                      safeCapture("navbar_book_demo_clicked", {
                        variant: "v2",
                        location: "navbar_desktop",
                      });
                    }}
                  >
                    Book a Demo
                  </Button>
                </>
              ) : (
                <Button
                  as={Link}
                  href="/dashboard"
                  bg="blue.500"
                  color="white"
                  size="sm"
                  transition="all 0.2s"
                  _hover={{
                    bg: "blue.600",
                    boxShadow: "md",
                  }}
                  onClick={() =>
                    safeCapture("navbar_dashboard_clicked", {
                      variant: "v2",
                      location: "navbar_desktop",
                    })
                  }
                >
                  Dashboard
                </Button>
              )}
            </HStack>

            <HStack spacing={3} display={{ base: "flex", md: "none" }}>
              {isLoaded && !userId ? (
                <Button
                  as={Link}
                  href="/demo"
                  bg="#FF6B35"
                  color="white"
                  size="sm"
                  transition="all 0.2s"
                  _hover={{
                    bg: "#E65A2E",
                    boxShadow: "md",
                  }}
                  onClick={() => {
                    safeCapture("navbar_book_demo_clicked", {
                      variant: "v2",
                      location: "navbar_mobile",
                    });
                  }}
                >
                  Book a Demo
                </Button>
              ) : (
                <Button
                  as={Link}
                  href="/dashboard"
                  bg="blue.500"
                  color="white"
                  size="sm"
                  transition="all 0.2s"
                  _hover={{
                    bg: "blue.600",
                    boxShadow: "md",
                  }}
                  onClick={() =>
                    safeCapture("navbar_dashboard_clicked", {
                      variant: "v2",
                      location: "navbar_mobile_header",
                    })
                  }
                >
                  Dashboard
                </Button>
              )}
              {!fromFbAd && (
                <IconButton
                  aria-label={isOpen ? "Close menu" : "Open menu"}
                  icon={isOpen ? <IoClose /> : <RxHamburgerMenu />}
                  variant="ghost"
                  onClick={isOpen ? handleClose : onOpen}
                  transition="all 0.2s"
                  _hover={{
                    bg: "blackAlpha.200",
                  }}
                />
              )}
            </HStack>
          </Flex>
        </Container>
      </Box>

      <Box
        position="fixed"
        top={isScrolled ? 4 : 0}
        left="50%"
        transform="translateX(-50%)"
        zIndex={200}
        display={isOpen ? "flex" : "none"}
        flexDirection="column"
        overflow="auto"
        w={isScrolled ? "95%" : "100vw"}
        h={isScrolled ? "calc(100vh - 16px)" : "100vh"}
        maxW="7xl"
        bg="white"
        borderTopRadius={isScrolled ? "2xl" : "0"}
        sx={{
          opacity: isClosing ? 0 : 1,
          transition: "opacity 0.2s ease-out",
          animation: isOpen && !isClosing ? "fadeIn 0.2s ease-out" : undefined,
          "@keyframes fadeIn": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      >
        <Flex
          h={14}
          px={6}
          alignItems="center"
          justify="space-between"
          borderBottom="1px"
          borderColor="gray.100"
        >
          <ChakraLink
            as={Link}
            href="/"
            display="flex"
            alignItems="center"
            gap={2}
            onClick={handleClose}
          >
            <IconWordmark />
          </ChakraLink>
          <IconButton
            aria-label="Close menu"
            icon={<IoClose />}
            variant="ghost"
            onClick={handleClose}
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
            }}
          />
        </Flex>

        <VStack spacing={0} align="stretch" flex={1} pt={8} px={6}>
          {navLinks.map((link) => (
            <ChakraLink
              key={link.href}
              as={Link}
              href={link.href}
              fontSize="2xl"
              fontWeight="medium"
              onClick={handleClose}
              transition="color 0.2s, transform 0.2s"
              py={4}
              _hover={{
                color: "purple.500",
                transform: "translateX(4px)",
              }}
            >
              {link.label}
            </ChakraLink>
          ))}

          {isLoaded && !userId && (
            <>
              <ChakraLink
                as={Link}
                href="/sign-in"
                fontSize="2xl"
                fontWeight="medium"
                onClick={() => {
                  safeCapture("navbar_sign_in_clicked", { variant: "v2", location: "mobile_menu" });
                  handleClose();
                }}
                transition="color 0.2s, transform 0.2s"
                py={4}
                _hover={{
                  color: "purple.500",
                  transform: "translateX(4px)",
                }}
              >
                Sign In
              </ChakraLink>
              <ChakraLink
                as={Link}
                href="/demo"
                onClick={() => {
                  safeCapture("navbar_book_demo_clicked", {
                    variant: "v2",
                    location: "mobile_menu",
                  });
                  handleClose();
                }}
                display="flex"
                alignItems="center"
                gap={2}
                fontSize="2xl"
                fontWeight="medium"
                color="#E65A2E"
                transition="color 0.2s, transform 0.2s"
                py={4}
                _hover={{
                  color: "#D54C21",
                  transform: "translateX(4px)",
                }}
              >
                Book a Demo
                <Box as={HiArrowRight} size="24px" />
              </ChakraLink>
            </>
          )}
        </VStack>
      </Box>
    </>
  );
};
