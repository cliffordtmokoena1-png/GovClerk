import { useState, useRef, KeyboardEvent } from "react";
import { LuX } from "react-icons/lu";

type Props = {
  speakers: string[];
  onChange: (speakers: string[]) => void;
  disabled?: boolean;
};

export function SpeakerTagInput({ speakers, onChange, disabled }: Props) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addSpeaker = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || speakers.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...speakers, trimmed]);
    setInputValue("");
  };

  const removeSpeaker = (name: string) => {
    onChange(speakers.filter((s) => s !== name));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSpeaker(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && speakers.length > 0) {
      removeSpeaker(speakers[speakers.length - 1]);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 min-h-10 rounded-md border border-border bg-background cursor-text focus-within:ring-2 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {speakers.map((speaker) => (
        <span
          key={speaker}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
        >
          {speaker}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeSpeaker(speaker);
              }}
              className="hover:text-primary/70 transition-colors"
              aria-label={`Remove ${speaker}`}
            >
              <LuX className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) {
              addSpeaker(inputValue);
            }
          }}
          placeholder={
            speakers.length === 0 ? "Add speaker name, press Enter..." : "Add another..."
          }
          className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}
