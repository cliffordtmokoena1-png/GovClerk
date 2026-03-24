import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { RiArrowGoForwardFill, RiPriceTag3Line } from "react-icons/ri";
import { FaRegTrashCan } from "react-icons/fa6";
import { colorFromString } from "@/utils/color";
import {
  Speaker,
  SpeakerLabelerOptions,
  buildSpeakerList,
  getDefaultSpeakerName,
  getValidSuggestion,
} from "@/lib/speakerLabeler";

const MAX_TRANSCRIPT_PREVIEW_LENGTH = 60;

function truncateText(text: string, maxLength = MAX_TRANSCRIPT_PREVIEW_LENGTH): string {
  if (maxLength <= 0) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

type SpeakerLabelerContentProps = {
  labelsToSpeaker: { [key: string]: Speaker };
  knownSpeakers: string[];
  selectedLabel: string;
  sortedSpeakers: [string, Speaker][];
  transcriptId?: number;
  segmentStart?: string;
  segmentStop?: string;
  segmentText?: string;
  onSpeakerLabeled: (name: string, selectedLabel: string, options?: SpeakerLabelerOptions) => void;
  onOpenRelabelModal?: () => void;
  menuOnClose: () => void;
  userInputName: string;
  setUserInputName: (value: string) => void;
  isDesktop: boolean;
  hideCurrentlyEditing?: boolean;
};

function SpeakerLabelerContentComponent({
  labelsToSpeaker,
  knownSpeakers,
  selectedLabel,
  sortedSpeakers,
  transcriptId,
  segmentStart,
  segmentStop,
  segmentText,
  onSpeakerLabeled,
  onOpenRelabelModal,
  menuOnClose,
  userInputName,
  setUserInputName,
  isDesktop,
  hideCurrentlyEditing = false,
}: SpeakerLabelerContentProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const speakerList = useMemo(
    () => buildSpeakerList(labelsToSpeaker, selectedLabel, knownSpeakers),
    [labelsToSpeaker, selectedLabel, knownSpeakers]
  );

  const validSuggestion = useMemo(
    () => getValidSuggestion(labelsToSpeaker, selectedLabel),
    [labelsToSpeaker, selectedLabel]
  );

  const defaultSpeakerName = useMemo(
    () => getDefaultSpeakerName(sortedSpeakers, selectedLabel),
    [sortedSpeakers, selectedLabel]
  );

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleInputSubmit = useCallback(() => {
    const trimmedName = userInputName.trim();
    if (trimmedName === "") {
      menuOnClose();
      return;
    }
    onSpeakerLabeled(trimmedName, selectedLabel);
    menuOnClose();
  }, [menuOnClose, onSpeakerLabeled, selectedLabel, userInputName]);

  const resetAndClose = useCallback(() => {
    setUserInputName("");
    menuOnClose();
  }, [menuOnClose, setUserInputName]);

  const currentSpeaker = labelsToSpeaker[selectedLabel]?.name || defaultSpeakerName;

  const isRelabelEnabled = Boolean(
    onOpenRelabelModal && transcriptId && segmentStart && segmentStop
  );

  return (
    <div
      className={`flex flex-col overflow-auto w-full h-full min-h-0 ${
        isDesktop ? "p-2 gap-2" : "gap-3"
      }`}
    >
      {isDesktop && (
        <div className="px-2 pb-1">
          <span className="text-xs font-semibold text-gray-600 tracking-wide">Label Speaker</span>
        </div>
      )}

      {!isDesktop && !hideCurrentlyEditing && (
        <div className="pt-2 pb-3 px-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700 mb-2 font-semibold tracking-wide uppercase">
              Currently editing
            </p>
            <p className="text-sm text-blue-800 leading-snug font-medium">
              <span className="font-semibold text-blue-900">{currentSpeaker}</span>
              {segmentText && (
                <>
                  {" • "}
                  <span className="text-blue-700">{truncateText(segmentText)}</span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className={isDesktop ? "px-2" : "px-4 pb-2"}>
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter speaker name"
            value={userInputName}
            onChange={(event) => setUserInputName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                handleInputSubmit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                resetAndClose();
              }
            }}
            className={`w-full border border-gray-300 rounded-xl bg-transparent px-4 py-3 text-sm
              placeholder:text-gray-500 placeholder:text-sm
              hover:border-gray-400
              focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none
              ${isDesktop ? "h-11" : "h-12"}`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={handleInputSubmit}
              className={`bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg px-3 cursor-pointer
                ${isDesktop ? "text-sm py-1" : "text-base py-1.5"}`}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className={isDesktop ? "px-2 mt-2 mb-2" : "px-4 mt-4 mb-3"}>
          <span
            className={`font-semibold tracking-wide ${
              isDesktop ? "text-xs text-gray-600" : "text-sm text-gray-700 tracking-wider"
            }`}
          >
            Quick Actions
          </span>
        </div>
        <div
          className={`grid ${isRelabelEnabled ? "grid-cols-3" : "grid-cols-2"} ${
            isDesktop ? "gap-2 px-2" : "gap-3 px-4"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onSpeakerLabeled(defaultSpeakerName, selectedLabel);
              resetAndClose();
            }}
            className="flex items-center justify-center gap-1.5
              border border-gray-200 rounded-lg px-2 h-10
              text-xs font-medium text-gray-700 bg-white
              hover:bg-gray-50 active:bg-gray-100
              cursor-pointer transition-colors"
          >
            <RiArrowGoForwardFill size={16} />
            Default
          </button>

          <button
            type="button"
            onClick={() => {
              onSpeakerLabeled(defaultSpeakerName, selectedLabel, {
                resetUses: true,
              });
              resetAndClose();
            }}
            className="flex items-center justify-center gap-1.5
              border border-red-200 rounded-lg px-2 h-10
              text-xs font-medium text-red-600 bg-white
              hover:bg-red-50 hover:border-red-300 active:bg-red-100
              cursor-pointer transition-colors"
          >
            <FaRegTrashCan size={16} />
            Reset
          </button>

          {isRelabelEnabled && onOpenRelabelModal && (
            <button
              type="button"
              onClick={() => {
                resetAndClose();
                setTimeout(() => {
                  onOpenRelabelModal();
                }, 0);
              }}
              className="flex items-center justify-center gap-1.5
                border border-blue-200 rounded-lg px-2 h-10
                text-xs font-medium text-blue-600 bg-white
                hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100
                cursor-pointer transition-colors"
            >
              <RiPriceTag3Line size={16} />
              Relabel
            </button>
          )}
        </div>
      </div>

      {validSuggestion && (
        <div className={`${isDesktop ? "px-2 mt-2 max-w-[320px] mx-auto" : "px-4 mt-4"}`}>
          <div className="bg-orange-50 border border-orange-200 rounded-xl py-2 px-3">
            <p className="text-xs font-medium text-orange-800">
              This voice matches a speaker in a past meeting: {validSuggestion.name}
            </p>
            <button
              type="button"
              onClick={() => {
                onSpeakerLabeled(defaultSpeakerName, selectedLabel, {
                  resetUses: true,
                  clearSuggestions: true,
                  flagSuggestion: true,
                });
              }}
              className="text-xs text-red-600 hover:underline mt-1 cursor-pointer"
            >
              This name is wrong
            </button>
          </div>
        </div>
      )}

      {speakerList.length > 0 && (
        <div className={`flex flex-col min-h-0 ${isDesktop ? "px-2 flex-none" : "px-4 flex-1"}`}>
          <div className={isDesktop ? "mt-2 mb-2" : "mt-4 mb-3"}>
            <span
              className={`font-semibold tracking-wide ${
                isDesktop ? "text-xs text-gray-600" : "text-sm text-gray-700 tracking-wider"
              }`}
            >
              Past Speakers
            </span>
          </div>
          <div
            className={`overflow-y-auto ${
              isDesktop
                ? "max-h-40 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                : "scrollbar-none"
            }`}
          >
            <div className="flex flex-col gap-1">
              {speakerList.map((speaker) => (
                <button
                  key={speaker.name}
                  type="button"
                  onClick={() => {
                    setUserInputName(speaker.name);
                    onSpeakerLabeled(speaker.name, selectedLabel);
                    menuOnClose();
                  }}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-lg
                    hover:bg-gray-100 active:bg-gray-200
                    cursor-pointer transition-colors text-left"
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-gray-800/20"
                    style={{ backgroundColor: colorFromString(speaker.name) }}
                  />
                  <span className="font-medium flex-1 text-sm truncate">{speaker.name}</span>
                  {speaker.similarity_score > 0.7 && (
                    <span className="text-xs font-medium text-gray-500 shrink-0">
                      {`${(speaker.similarity_score * 100).toFixed(0)}% match`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const SpeakerLabelerContent = React.memo(SpeakerLabelerContentComponent);

type SpeakerLabelerPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
} & SpeakerLabelerContentProps;

export function SpeakerLabelerPopover({
  isOpen,
  onClose,
  anchorEl,
  ...contentProps
}: SpeakerLabelerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !anchorEl) {
      return;
    }

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const popoverWidth = 320;
      const padding = 8;
      const popoverHeight = popoverRef.current?.offsetHeight || 420;

      let top = rect.bottom + padding;
      let left = rect.left;

      // Keep within viewport horizontally
      if (left + popoverWidth > window.innerWidth - padding) {
        left = window.innerWidth - popoverWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      // If not enough room below, position above anchor
      if (top + popoverHeight > window.innerHeight - padding) {
        top = rect.top - popoverHeight - padding;
      }
      // If not enough room above either, clamp to top
      if (top < padding) {
        top = padding;
      }

      positionRef.current = { top, left };
      if (popoverRef.current) {
        popoverRef.current.style.top = `${top}px`;
        popoverRef.current.style.left = `${left}px`;
      }
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, anchorEl]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 max-h-[420px] bg-white rounded-xl shadow-xl
        border border-gray-200 overflow-hidden
        animate-in fade-in slide-in-from-top-1 duration-150"
      style={{
        top: positionRef.current.top,
        left: positionRef.current.left,
      }}
    >
      <SpeakerLabelerContent {...contentProps} isDesktop menuOnClose={onClose} />
    </div>,
    document.body
  );
}

type SpeakerLabelerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
} & Omit<SpeakerLabelerContentProps, "isDesktop">;

export function SpeakerLabelerDrawer({
  isOpen,
  onClose,
  ...contentProps
}: SpeakerLabelerDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        className="relative bg-white rounded-t-2xl shadow-2xl
          max-h-[85vh] flex flex-col
          animate-in slide-in-from-bottom duration-300 ease-out"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-semibold text-gray-900">Label Speaker</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-auto pb-safe pb-6">
          <SpeakerLabelerContent {...contentProps} isDesktop={false} menuOnClose={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
}
