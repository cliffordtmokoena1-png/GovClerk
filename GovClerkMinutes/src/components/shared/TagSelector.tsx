/**
 * Reusable tag selector dropdown component.
 * Provides tag selection with creation functionality.
 * Used in meeting creation and editing modals.
 */

import { useState, useRef, useEffect } from "react";
import { LuX, LuPlus, LuCheck, LuChevronDown } from "react-icons/lu";

interface TagSelectorProps {
  /** Currently selected tags */
  readonly selectedTags: string[];
  /** Callback when tags change */
  readonly onChange: (tags: string[]) => void;
  /** Available existing tags to choose from */
  readonly existingTags: string[];
  /** Label for the field */
  readonly label?: string;
  /** Placeholder text when no tags selected */
  readonly placeholder?: string;
  /** Whether the selector is disabled */
  readonly disabled?: boolean;
}

/**
 * A dropdown component for selecting and creating tags.
 * Features:
 * - Select from existing tags
 * - Create new tags inline
 * - Remove selected tags
 * - Keyboard navigation support
 */
export function TagSelector({
  selectedTags,
  onChange,
  existingTags,
  label = "Tags",
  placeholder = "Select tags...",
  disabled = false,
}: Readonly<TagSelectorProps>) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the new tag input when creating
  useEffect(() => {
    if (isCreatingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isCreatingTag]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsCreatingTag(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    onChange(newTags);
  };

  const handleCreateNewTag = () => {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      onChange([...selectedTags, trimmedTag]);
    }
    setNewTagInput("");
    setIsCreatingTag(false);
  };

  const handleNewTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateNewTag();
    } else if (e.key === "Escape") {
      setIsCreatingTag(false);
      setNewTagInput("");
    }
  };

  const getDisplayText = () => {
    if (selectedTags.length > 0) {
      return `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`;
    }
    return placeholder;
  };

  return (
    <div ref={dropdownRef} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-gray-500">{getDisplayText()}</span>
        <LuChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                disabled={disabled}
                className="hover:text-blue-600 disabled:opacity-50"
              >
                <LuX className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isDropdownOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isCreatingTag ? (
            <div className="p-2">
              <div className="flex items-center gap-2">
                <input
                  ref={newTagInputRef}
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={handleNewTagKeyDown}
                  placeholder="Enter new tag name"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCreateNewTag}
                  disabled={!newTagInput.trim()}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LuCheck className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingTag(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
            >
              <LuPlus className="w-4 h-4" />
              Create new tag...
            </button>
          )}

          {existingTags.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              {existingTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>{tag}</span>
                  {selectedTags.includes(tag) && <LuCheck className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </>
          )}

          {existingTags.length === 0 && !isCreatingTag && (
            <div className="px-3 py-2 text-sm text-gray-500">No existing tags</div>
          )}
        </div>
      )}
    </div>
  );
}
