import { useEffect, useState, useRef } from "react";
import { Box, Container, Text } from "@chakra-ui/react";
import Image from "next/image";
import { safeCapture } from "@/utils/safePosthog";

const GradientOverlay = ({ direction }: { direction: "left" | "right" }) => (
  <Box
    position="absolute"
    {...(direction === "left" ? { left: 0 } : { right: 0 })}
    top={0}
    bottom={0}
    width={{ base: "60px", md: "120px" }}
    zIndex={2}
    pointerEvents="none"
    bgGradient={
      direction === "left" ? "linear(to-r, #152a4e, transparent)" : "linear(to-l, #152a4e, transparent)"
    }
  />
);

export const CompanyCarousel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const animationDuration = 40;
  const logoWidth = 160;
  const logoSpacing = 40;

  const logos = [
    { src: "/logos/Ikea_logo.svg", alt: "Ikea" },
    { src: "/logos/Standard_Bank.png", alt: "Standard Bank" },
    { src: "/logos/UN_emblem_logo.png", alt: "United Nations" },
    { src: "/logos/Broadcom_logo_(2016-present).svg", alt: "Broadcom" },
    { src: "/logos/UCambridge.png", alt: "University of Cambridge" },
    { src: "/logos/PricewaterhouseCoopers_Logo.svg", alt: "PwC" },
    { src: "/logos/Bosch-logotype.svg", alt: "Bosch" },
    { src: "/logos/Absa_Logo.svg", alt: "Absa" },
    { src: "/logos/Centene_Corporation_Logo.svg", alt: "Centene" },
    { src: "/logos/Mediclinicgrouplogo.png", alt: "Mediclinic" },
    { src: "/logos/New-mtn-logo.jpg", alt: "MTN" },
  ];

  useEffect(() => {
    setIsInitialized(true);

    const container = containerRef.current;
    if (container && container.scrollWidth <= container.clientWidth * 2) {
      const originalLogos = Array.from(container.children);
      originalLogos.forEach((logo) => {
        const clone = logo.cloneNode(true);
        container.appendChild(clone);
      });
    }

    return () => {
      setIsInitialized(false);
    };
  }, []);

  // Use constant animation speed (scroll-based speed disabled to prevent hyperspeed)
  const adjustedDuration = animationDuration;

  return (
    <Box
      as="section"
      pt={{ base: 8, md: 12 }}
      pb={{ base: 12, md: 16 }}
      position="relative"
      overflow="hidden"
      bg="#152a4e"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "logos",
          variant: "v2",
        });
      }}
    >
      <Container maxW="7xl">
        <Text
          textAlign="center"
          fontSize={{ base: "sm", md: "md" }}
          color="white"
          fontWeight="medium"
          mb={8}
          letterSpacing="wide"
        >
          TRUSTED BY LEADING ORGANIZATIONS
        </Text>
      </Container>

      <Box width="100%" overflow="hidden" position="relative">
        <GradientOverlay direction="left" />
        <GradientOverlay direction="right" />

        <Box
          ref={containerRef}
          display="flex"
          alignItems="center"
          width="max-content"
          style={{
            animation: isInitialized ? `scrollLogos ${adjustedDuration}s linear infinite` : "none",
          }}
        >
          {logos.map((logo, index) => (
            <Box
              key={index}
              mx={`${logoSpacing}px`}
              width={`${logoWidth}px`}
              height="120px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Image
                src={logo.src}
                alt={logo.alt}
                style={{
                  objectFit: "contain",
                  maxWidth: "140px",
                  maxHeight: "80px",
                  filter: "grayscale(100%) brightness(2)",
                  opacity: 0.7,
                }}
                width={140}
                height={80}
              />
            </Box>
          ))}
        </Box>

        <style jsx global>{`
          @keyframes scrollLogos {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </Box>
    </Box>
  );
};
