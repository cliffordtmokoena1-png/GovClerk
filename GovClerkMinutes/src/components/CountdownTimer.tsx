import { Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type Props = {
  targetDate: Date;
};

const calculateTimeLeft = (difference: number): TimeLeft => {
  if (difference > 0) {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  } else {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }
};

export default function CountdownTimer({ targetDate }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>();

  useEffect(() => {
    // @ts-ignore
    setTimeLeft(calculateTimeLeft(targetDate - new Date()));
    const timer = setInterval(() => {
      const now = new Date();
      // @ts-ignore
      const difference = targetDate - now;
      setTimeLeft(calculateTimeLeft(difference));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const padTime = (time: number): string => {
    return time.toString().padStart(2, "0");
  };

  if (!timeLeft) {
    return <Flex h={6}></Flex>;
  }

  return (
    <Flex gap={3} fontSize="md" h={6} w="full" justifyContent="center">
      <Flex>
        <Text fontWeight="extrabold">
          {padTime(timeLeft.days)}
          &nbsp;
          <Text as="span" fontWeight="normal">
            {timeLeft.days === 1 ? "day" : "days"}
          </Text>
        </Text>
      </Flex>
      <Flex>
        <Text fontWeight="extrabold">
          {padTime(timeLeft.hours)}
          &nbsp;
          <Text as="span" fontWeight="normal">
            {timeLeft.hours === 1 ? "hour" : "hours"}
          </Text>
        </Text>
      </Flex>
      <Flex>
        <Text fontWeight="extrabold">
          {padTime(timeLeft.minutes)}
          &nbsp;
          <Text as="span" fontWeight="normal">
            {timeLeft.minutes === 1 ? "minute" : "minutes"}
          </Text>
        </Text>
      </Flex>
      <Flex>
        <Text fontWeight="extrabold">
          {padTime(timeLeft.seconds)}
          &nbsp;
          <Text as="span" fontWeight="normal">
            seconds
          </Text>
        </Text>
      </Flex>
    </Flex>
  );
}
