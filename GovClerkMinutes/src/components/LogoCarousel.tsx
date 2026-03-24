import React, { useEffect, useState, useRef } from "react";
import { Box } from "@chakra-ui/react";
import Image from "next/image";

const LogoCarousel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const animationDuration = 60;
  const logoWidth = 150;
  const logoSpacing = 20;

  const logos = [
    { src: "/logos/Ikea_logo.svg", alt: "Ikea" },
    { src: "/logos/Standard_Bank.png", alt: "Standard Bank" },
    { src: "/logos/UN_emblem_logo.png", alt: "United Nations" },
    { src: "/logos/Broadcom_logo_(2016-present).svg", alt: "Broadcom" },
    {
      src: "/logos/UCambridge.png",
      alt: "University of Cambridge",
    },
    { src: "/logos/PricewaterhouseCoopers_Logo.svg", alt: "PricewaterhouseCoopers" },
    { src: "/logos/Bosch-logotype.svg", alt: "Bosch" },
    { src: "/logos/Absa_Logo.svg", alt: "Absa" },
    { src: "/logos/Centene_Corporation_Logo.svg", alt: "Centene Corporation" },
    { src: "/logos/Mediclinicgrouplogo.png", alt: "Mediclinic Group" },
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

    if (container) {
      container.style.transform = "translateX(0)";
    }

    return () => {
      setIsInitialized(false);
    };
  }, []);

  return (
    <Box width="100%" overflow="hidden" position="relative">
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        width="100px"
        zIndex={2}
        pointerEvents="none"
        bgGradient="linear(to-r, white, transparent)"
      />

      <Box
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        width="100px"
        zIndex={2}
        pointerEvents="none"
        bgGradient="linear(to-l, white, transparent)"
      />
      <Box
        ref={containerRef}
        display="flex"
        alignItems="center"
        width="max-content"
        style={{
          animation: isInitialized ? `scrollLogos ${animationDuration}s linear infinite` : "none",
        }}
      >
        {logos.map((logo, index) => (
          <Box
            key={index}
            mx={`${logoSpacing}px`}
            width={`${logoWidth}px`}
            height="80px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Box
              width="80%"
              height="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Box
                maxH="80%"
                maxW="80%"
                style={{
                  filter: hoveredIndex === index ? "grayscale(0%)" : "grayscale(100%)",
                  opacity: hoveredIndex === index ? 1 : 0.7,
                  transition: "all 0.3s ease",
                }}
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  style={{
                    objectFit: "contain",
                    width: "100%",
                    height: "100%",
                  }}
                  width={120}
                  height={64}
                />
              </Box>
            </Box>
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
  );
};

export default LogoCarousel;
