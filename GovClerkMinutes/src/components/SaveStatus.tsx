import { Box, Tooltip } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaSpinner, FaCheck, FaHistory } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";

type Props = {
  lastSaved: Date | null;
  isSaving: boolean;
};

export const SaveStatus = ({ lastSaved, isSaving }: Props) => {
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isSaving && lastSaved) {
      timer = setTimeout(() => {
        setShowVersionHistory(true);
      }, 3000);
    } else {
      setShowVersionHistory(false);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [isSaving, lastSaved]);

  const getIcon = () => {
    if (isSaving) {
      return <FaSpinner className="fa-spin" />;
    }
    if (!showVersionHistory && lastSaved) {
      return <FaCheck />;
    }
    return <FaHistory />;
  };

  const getTooltipText = () => {
    if (isSaving) {
      return "Saving...";
    }
    if (lastSaved) {
      return `Last saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`;
    }
    return "";
  };

  return (
    <Tooltip label={getTooltipText()} isDisabled={!getTooltipText()}>
      <Box color="gray.500" fontSize="sm">
        {getIcon()}
      </Box>
    </Tooltip>
  );
};
