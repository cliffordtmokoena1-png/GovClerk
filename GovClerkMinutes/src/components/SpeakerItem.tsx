import { colorFromString } from "@/utils/color";
import { Box, Text, Flex } from "@chakra-ui/react";
import CircleIcon from "./CircleIcon";

type Props = {
  speaker: string;
  onClick?: () => void;
  bg?: string;
  hideCircle?: boolean;
};
const SpeakerItem = ({ speaker, onClick, bg, hideCircle }: Props) => {
  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      borderRadius="2xl"
      fontWeight="bold"
      cursor="pointer"
      onClick={() => {
        if (onClick == null) {
          return;
        }
        onClick();
      }}
    >
      <Text>{speaker}</Text>
    </Flex>
  );
};

export default SpeakerItem;
