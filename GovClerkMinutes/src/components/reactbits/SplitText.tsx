import { useRef, useEffect, useState, useMemo } from "react";
import { motion, useInView } from "framer-motion";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  characterDuration?: number;
};

export default function SplitText({
  text,
  className = "",
  delay = 0,
  characterDuration = 0.35,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (isInView && !hasTriggered) {
      setHasTriggered(true);
    }
  }, [isInView, hasTriggered]);

  const words = useMemo(() => text.split(" "), [text]);

  let charIndex = 0;

  return (
    <span ref={ref} className={`inline ${className}`}>
      {words.map((word, wordIdx) => (
        <span key={wordIdx} className="inline-block whitespace-nowrap">
          {word.split("").map((char) => {
            const currentIndex = charIndex++;
            return (
              <motion.span
                key={`${wordIdx}-${currentIndex}`}
                className="inline-block"
                initial={{ opacity: 0, y: 20 }}
                animate={hasTriggered ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{
                  duration: characterDuration,
                  delay: delay + currentIndex * 0.025,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                {char}
              </motion.span>
            );
          })}
          {wordIdx < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}
