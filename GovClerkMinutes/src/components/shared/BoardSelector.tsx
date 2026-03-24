/**
 * Reusable board selector dropdown component.
 * Used in meeting creation and editing modals.
 */

import { useState, useRef, useEffect } from "react";
import { LuChevronDown, LuCheck, LuPlus } from "react-icons/lu";
import type { Board } from "@/board/types";

interface BoardSelectorProps {
  readonly boards: Board[];
  readonly selectedBoardId?: number;
  readonly onSelect: (boardId: number | undefined) => void;
  readonly isLoading?: boolean;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly placeholder?: string;
  readonly onAddBoard?: () => void;
  readonly required?: boolean;
}

export function BoardSelector({
  boards,
  selectedBoardId,
  onSelect,
  isLoading = false,
  disabled = false,
  label = "Board",
  placeholder = "Select a board...",
  onAddBoard,
  required = false,
}: Readonly<BoardSelectorProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedBoard = boards.find((b) => Number(b.id) === selectedBoardId);

  const handleSelect = (boardId: number | undefined) => {
    onSelect(boardId);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (isLoading) {
      return "Loading boards...";
    }
    if (selectedBoard) {
      return selectedBoard.name;
    }
    return placeholder;
  };

  return (
    <div ref={dropdownRef} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between"
        disabled={isLoading || disabled}
      >
        <span className={selectedBoard ? "text-gray-900" : "text-gray-500"}>
          {getDisplayText()}
        </span>
        <LuChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {/* No board option */}
          {!required && (
            <>
              <button
                type="button"
                onClick={() => handleSelect(undefined)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span>No board</span>
                {!selectedBoardId && <LuCheck className="w-4 h-4 text-blue-600" />}
              </button>
            </>
          )}

          {boards.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => handleSelect(Number(board.id))}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>{board.name}</span>
                  {Number(board.id) === selectedBoardId && (
                    <LuCheck className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))}
            </>
          )}

          {boards.length === 0 && !isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">No boards available</div>
          )}

          {onAddBoard && (
            <div className="border-t border-gray-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  onAddBoard();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
              >
                <LuPlus className="w-4 h-4" />
                <span>Add new board</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
