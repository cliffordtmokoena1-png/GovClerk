import { Box, Textarea, Text, Heading, Center, UnorderedList, ListItem } from "@chakra-ui/react";

type Props = {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  disabled: boolean;
};

const TranscriptContextTextArea = ({ prompt, onPromptChange, disabled }: Props) => {
  return (
    <Box w="full" pt={disabled ? 2 : 7}>
      {!disabled ? (
        <Heading size="sm" pb={1}>
          <UnorderedList spacing={1}>
            <ListItem>Write a short description of the audio</ListItem>
            <ListItem>
              Including names of people and places will help the AI spell words correctly 🤓
            </ListItem>
          </UnorderedList>
        </Heading>
      ) : null}
      <Textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Example: This is a conversation between John Smith and Jane Doe at the Taj Mahal."
        resize="vertical"
        minH="60px"
        maxLength={2048}
        bgColor="gray.50"
        w="full"
        fontSize="md"
        isReadOnly={disabled}
        cursor={disabled ? "not-allowed" : "auto"}
      />
    </Box>
  );
};

export default TranscriptContextTextArea;
