import { useDisclosure } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import OpenSystemBrowserModal from "./OpenSystemBrowserModal";
import isFbIg from "@/utils/isFbIg";

type Props = {};
export default function OpenSystemBrowserInterstitial({}: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [openSystemBrowserModalClosed, setOpenSystemBrowserModalClosed] = useState<boolean>(false);

  useEffect(() => {
    if (isFbIg(navigator.userAgent) && !openSystemBrowserModalClosed) {
      onOpen();
    }
  }, [onOpen, openSystemBrowserModalClosed]);

  return (
    <OpenSystemBrowserModal
      isOpen={isOpen}
      onClose={() => {
        setOpenSystemBrowserModalClosed(true);
        onClose();
      }}
    />
  );
}
