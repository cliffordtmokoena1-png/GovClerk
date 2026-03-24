import { Box, Container, Heading, Text, VStack, HStack, Icon } from "@chakra-ui/react";
import { FaStar } from "react-icons/fa";
import { useRef, useEffect, useState } from "react";
import { safeCapture } from "@/utils/safePosthog";

const StarRating = () => (
  <HStack spacing={1} color="yellow.400">
    {[...Array(5)].map((_, i) => (
      <Icon key={i} as={FaStar} boxSize={4} />
    ))}
  </HStack>
);

export const TestimonialsSection = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const testimonials = [
    {
      name: "Lucy M.",
      location: "GovClerkMinutes customer",
      date: "",
      text: "I love it. I normally take 5 days to do minutes but with this it was done in just below an hour! It's so professional, doesn't leave out important details and saves me so much time.",
    },
    {
      name: "Lisa T.",
      location: "Business Manager",
      date: "",
      text: "I like it! I can easily take these bullets from the summary and have Chat GPT turn them into more of a narrative. Transcript is good too!",
    },
    {
      name: "Tumi",
      location: "ZA",
      date: "Sep 26, 2025",
      text: "This company is so efficient and reliable, their minutes are so accurate, they are really saving me so much time to focus on other tasks.",
    },
    {
      name: "Don",
      location: "US",
      date: "Sep 17, 2025",
      text: "Does a good job of listening and sorting out our chaotic meetings and generating useful and coherent representations of those meetings.",
    },
    {
      name: "QueenE Mbatha",
      location: "ZA",
      date: "Sep 2, 2025",
      text: "The service is top notch, and they go above and beyond to ensure that your query is resolved immediately.",
    },
    {
      name: "TSei",
      location: "ZA",
      date: "Aug 28, 2025",
      text: "I am honest 100% happy with the assistant received, the patience. I am definitely upgrading for my future meetings. The minutes were done as needed and accurate as supposed to be.",
    },
    {
      name: "Dale Ross",
      location: "ZA",
      date: "Aug 28, 2025",
      text: "Wow... This is Great. Usually we spend hours trying to get proper minutes and action items for meetings. It generated this in mere minutes and the accuracy is astounding. Quick, Easy to use & Accurate.",
    },
    {
      name: "skhombiso shabalala",
      location: "ZA",
      date: "Aug 22, 2025",
      text: "I would like to extend my heartfelt gratitude to the company for transcribing my minutes. The service and tolerance that Mr Cliff provided to me was fantastic!",
    },
    {
      name: "Melvin Kesiile",
      location: "ZA",
      date: "Aug 13, 2025",
      text: "Because I managed to write the minutes within five minutes, and it has impressed my supervisor.",
    },
    {
      name: "Mark Halliday",
      location: "AU",
      date: "Jul 31, 2025",
      text: "This is an excellent tool should you be tasked with producing meeting minutes. It will save you a ton of work, freeing you up to do more agreeable tasks or even recreation!",
    },
    {
      name: "David Tshamaano Muhadi",
      location: "ZA",
      date: "Jul 29, 2025",
      text: "Online support is sometimes helpful and WhatsApp is very helpful.",
    },
    {
      name: "Clifford Mokoena",
      location: "ZA",
      date: "Jul 29, 2025",
      text: "It's user-friendly and easy to use. In a few minutes, you get your minutes generated and can translate them into any language.",
    },
    {
      name: "Jayda Thomas",
      location: "US",
      date: "Jul 10, 2025",
      text: "Simple, Fast, and Accurate!",
    },
    {
      name: "Dan B",
      location: "US",
      date: "Mar 27, 2025",
      text: "Mind is literally blown. I'm stoked to save a lot of time during in-person meetings, using this app.",
    },
  ];

  useEffect(() => {
    setIsInitialized(true);

    const container = scrollRef.current;
    if (container && container.scrollWidth <= container.clientWidth * 2) {
      const originalTestimonials = Array.from(container.children);
      originalTestimonials.forEach((testimonial) => {
        const clone = testimonial.cloneNode(true);
        container.appendChild(clone);
      });
    }

    return () => {
      setIsInitialized(false);
    };
  }, []);

  return (
    <Box
      as="section"
      py={{ base: 16, md: 24 }}
      bg="#152a4e"
      overflow="hidden"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "testimonials",
          variant: "v2",
        });
      }}
    >
      <Container maxW="7xl" mb={12}>
        <VStack spacing={4} textAlign="center">
          <Heading
            as="h2"
            fontSize={{ base: "3xl", md: "5xl" }}
            fontWeight="normal"
            fontFamily="Georgia, serif"
            color="white"
          >
            Loved by Professionals Worldwide
          </Heading>
          <Text fontSize={{ base: "lg", md: "xl" }} color="blue.200" maxW="2xl">
            See what our users are saying about their experience
          </Text>
        </VStack>
      </Container>

      {/* Scrollable Testimonials */}
      <Box overflow="hidden" position="relative" py={4}>
        <HStack
          ref={scrollRef}
          spacing={4}
          align="stretch"
          width="max-content"
          style={{
            animation: isInitialized ? "scrollTestimonials 60s linear infinite" : "none",
          }}
        >
          {testimonials.map((testimonial, index) => (
            <Box
              key={index}
              minW={{ base: "280px", md: "350px" }}
              maxW={{ base: "280px", md: "350px" }}
              p={6}
              bg="rgba(255, 255, 255, 0.05)"
              backdropFilter="blur(12px)"
              borderRadius="xl"
              border="1px solid"
              borderColor="rgba(255, 255, 255, 0.1)"
              transition="all 0.3s"
              display="flex"
              flexDirection="column"
              _hover={{
                "@media (hover: hover)": {
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  boxShadow: "lg",
                  transform: "translateY(-2px)",
                },
              }}
            >
              <VStack align="start" spacing={4} flex="1">
                <StarRating />
                <Text color="whiteAlpha.800" fontSize="sm" lineHeight="tall">
                  &ldquo;{testimonial.text}&rdquo;
                </Text>
                <VStack align="start" spacing={0} pt={2} mt="auto">
                  <Text fontWeight="semibold" color="white" fontSize="sm">
                    {testimonial.name}
                  </Text>
                  <Text fontSize="xs" color="whiteAlpha.600">
                    {testimonial.location}
                    {testimonial.date ? ` • ${testimonial.date}` : ""}
                  </Text>
                </VStack>
              </VStack>
            </Box>
          ))}
        </HStack>

        <style jsx global>{`
          @keyframes scrollTestimonials {
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
