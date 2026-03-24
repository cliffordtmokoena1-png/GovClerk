import { ChangeEventHandler, useState } from "react";
import {
  Box,
  Button,
  Input,
  Text,
  Heading,
  FormControl,
  FormLabel,
  UnorderedList,
  ListItem,
  Stack,
} from "@chakra-ui/react";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { safeCapture } from "@/utils/safePosthog";
import { getNextWebinarDetails } from "@/utils/webinar";

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  const webinarDetails = await getNextWebinarDetails();
  if (webinarDetails == null) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const { url, eventTime } = webinarDetails;
  return {
    props: {
      url,
      eventTime,
    },
  };
});

type Props = {
  url: string;
  eventTime: string;
};

export default function Home({ url, eventTime }: Props) {
  const [registered, setRegistered] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
  });

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    fetch("/api/register-for-training", {
      method: "POST",
      body: JSON.stringify({
        ...formData,
        url,
        eventTime,
        prettyEventTime: getPrettyEventTime(eventTime),
      }),
    });
    setRegistered(true);
    safeCapture("training_registration", {
      email: formData.email,
      first_name: formData.firstName,
      xurl: url,
      event_time: eventTime,
    });
  };

  return (
    <Box maxW={{ base: "xl", md: "2xl" }} mx="auto" p={8}>
      <Heading as="h1" size={{ base: "xl", md: "2xl" }} textAlign="center" mb={4}>
        Join our Free Training!
      </Heading>
      <Text fontSize={{ base: "xl", md: "2xl" }} textAlign="center" fontWeight="semibold" mb={4}>
        {getPrettyEventTime(eventTime)}
      </Text>
      <Text textAlign="center" mb={6}>
        Hosted on Facebook Live
      </Text>
      <Text mb={4}>Learn how to easily generate high-quality meeting minutes!</Text>
      <Text mb={4}>Here&apos;s what to expect:</Text>
      <UnorderedList mb={8} pl={4}>
        <ListItem>A demo of how to generate minutes with our service</ListItem>
        <ListItem>A quick session &nbsp; (30 minutes or less)</ListItem>
        <ListItem fontWeight="bold">A special discount code</ListItem>
      </UnorderedList>
      {!registered ? (
        <Box as="form" onSubmit={handleSubmit}>
          <Stack spacing={4}>
            <FormControl id="firstName" isRequired>
              <FormLabel>First Name</FormLabel>
              <Input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Your first name"
              />
            </FormControl>
            <FormControl id="email" isRequired>
              <FormLabel>Email Address</FormLabel>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            </FormControl>
            <Button type="submit" colorScheme="orange" size="lg">
              Register
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box textAlign="center">
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            You&apos;re in! We sent you a confirmation email.
          </Text>
          <Text mb={6}>
            We <strong>strongly recommend</strong> registering on Facebook to get notified when
            it&apos;s time.
          </Text>
          <Button as="a" href={url} colorScheme="messenger" size="lg">
            Go to Facebook Event
          </Button>
        </Box>
      )}
    </Box>
  );
}

function getPrettyEventTime(eventTime: string): string {
  const date = new Date(eventTime);
  const month = date.toLocaleString("default", { month: "long" });
  const day = date.getDate();
  const time = date
    .toLocaleString("default", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  const dow = date.toLocaleString("default", { weekday: "long" });

  return `${dow}, ${month} ${day}, ${time}`;
}
