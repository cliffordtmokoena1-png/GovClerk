"use client";
import React from "react";
import { Box, Button, Container, Flex, HStack, Link as ChakraLink } from "@chakra-ui/react";
import Link from "next/link";
import IconWordmark from "@/components/IconWordmark";
import { useAuth } from "@clerk/nextjs";

type Props = {
  fromFbAd: boolean;
};

export const NavBar = ({ fromFbAd }: Props) => {
  const { isLoaded, userId } = useAuth();

  return (
    <Box
      as="nav"
      position="fixed"
      top={4}
      left="50%"
      transform="translateX(-50%)"
      zIndex={100}
      w="95%"
      maxW="7xl"
      bg="rgba(200, 220, 255, 0.7)"
      backdropFilter="blur(12px)"
      borderRadius="2xl"
      border="1px solid rgba(255, 255, 255, 0.1)"
    >
      <Container maxW="full" px={6}>
        <Flex h={14} alignItems="center" justify="space-between">
          <HStack spacing={8} color="black">
            <ChakraLink as={Link} href="/" display="flex" alignItems="center">
              <IconWordmark />
            </ChakraLink>
            <HStack spacing={8} display={{ base: "none", md: "flex" }}>
              <ChakraLink
                as={Link}
                href="/#pricing"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ color: "purple.200" }}
              >
                Pricing
              </ChakraLink>
              <ChakraLink
                as={Link}
                href="/#features"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ color: "purple.200" }}
              >
                Features
              </ChakraLink>
              <ChakraLink
                as={Link}
                href="/blog"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ color: "purple.200" }}
              >
                Blog
              </ChakraLink>
            </HStack>
          </HStack>

          <HStack spacing={4}>
            {isLoaded && !userId ? (
              <>
                {!fromFbAd && (
                  <Button
                    as={Link}
                    href="/sign-in"
                    variant="ghost"
                    size="sm"
                    color="black"
                    _hover={{ bg: "blackAlpha.200" }}
                  >
                    Sign In
                  </Button>
                )}
                <Button
                  as={Link}
                  href="/sign-up"
                  bg="blue.500"
                  color="white"
                  size="sm"
                  _hover={{ bg: "blue.600" }}
                >
                  Get Started
                </Button>
              </>
            ) : (
              <Button
                as={Link}
                href="/dashboard"
                bg="blue.500"
                color="white"
                size="sm"
                _hover={{ bg: "blue.600" }}
              >
                Go to Dashboard
              </Button>
            )}
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};
