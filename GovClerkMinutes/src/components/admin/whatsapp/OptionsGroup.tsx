import React from "react";
import { Checkbox, Flex } from "@chakra-ui/react";

type Props = {
  makeHubspotTask: boolean;
  cancelOnReply: boolean;
  onChange: (next: { makeHubspotTask: boolean; cancelOnReply: boolean }) => void;
};

export default function OptionsGroup({ makeHubspotTask, cancelOnReply, onChange }: Props) {
  return (
    <Flex flexDir="column" justifyContent="space-between" gap={0}>
      {/* Make Hubspot Task Checkbox */}
      <Checkbox
        size="sm"
        isChecked={makeHubspotTask}
        onChange={(e) => onChange({ makeHubspotTask: e.target.checked, cancelOnReply })}
        defaultChecked
      >
        Make Hubspot Task
      </Checkbox>

      {/* Cancel On Reply Checkbox */}
      <Checkbox
        size="sm"
        isChecked={cancelOnReply}
        onChange={(e) => onChange({ makeHubspotTask, cancelOnReply: e.target.checked })}
        defaultChecked
      >
        Cancel On Reply
      </Checkbox>
    </Flex>
  );
}
