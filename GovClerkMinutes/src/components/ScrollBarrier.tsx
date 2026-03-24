import { Flex } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

type EnterState = "initial" | "entered" | "exited";

type Props = {
  offset?: number;
  onEnter?: () => void;
  onExit?: () => void;
};
export default function ScrollBarrier({ offset, onEnter, onExit }: Props) {
  const observerRef = useRef<HTMLDivElement | null>(null);
  const enterState = useRef<EnterState>("initial");

  useEffect(() => {
    const currentRef = observerRef.current;
    const handleScroll = () => {
      if (currentRef) {
        const rect = currentRef.getBoundingClientRect();
        // console.log(rect.top);
        // console.log(window.innerHeight);
        if (rect.top <= (offset || 0)) {
          if (enterState.current === "initial" || enterState.current === "exited") {
            enterState.current = "entered";
            if (onEnter) {
              onEnter();
            }
          }
        } else {
          if (enterState.current === "initial" || enterState.current === "entered") {
            enterState.current = "exited";
            if (onExit) {
              onExit();
            }
          }
        }
      }
    };

    document.addEventListener("scroll", handleScroll);

    return () => {
      document.removeEventListener("scroll", handleScroll);
    };
  }, [offset, onEnter, onExit]);

  return <Flex ref={observerRef} w="full" h={0}></Flex>;
}
