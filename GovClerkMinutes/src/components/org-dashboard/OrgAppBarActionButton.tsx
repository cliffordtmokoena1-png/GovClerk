import React, { useState, useRef, useEffect, useCallback } from "react";
import type { OrgAppBarAction } from "./context/OrgAppBarContext";

interface OrgAppBarActionButtonProps {
  readonly action: OrgAppBarAction;
}

export function OrgAppBarActionButton({ action }: Readonly<OrgAppBarActionButtonProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    icon: Icon,
    label,
    expanded,
    bgColor = "bg-blue-600",
    textColor = "white",
    dropdownComponent: DropdownComponent,
    dropdownProps = {},
    onClick,
  } = action;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close dropdown on escape
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleClick = useCallback(() => {
    if (DropdownComponent) {
      setIsOpen((prev) => !prev);
    } else if (onClick) {
      onClick();
    }
  }, [DropdownComponent, onClick]);

  const handleCloseDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const textColorClass = textColor === "white" ? "text-white" : "text-foreground";
  const isHexColor = bgColor.startsWith("#");
  const bgClass = expanded && !isHexColor ? bgColor : "";

  const getHoverStyle = () => {
    if (!expanded) {
      return {};
    }
    if (isHexColor) {
      // Darken hex color on hover by using a filter
      return { backgroundColor: bgColor };
    }
    return {};
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`
          flex items-center gap-2 rounded-lg transition-all duration-200
          ${
            expanded
              ? `px-3 py-1.5 ${bgClass} ${textColorClass} hover:brightness-90 active:brightness-75`
              : "p-2 text-foreground/80 hover:text-foreground hover:bg-accent"
          }
        `}
        style={getHoverStyle()}
        aria-expanded={isOpen}
        aria-haspopup={!!DropdownComponent}
      >
        <Icon className="w-4 h-4" />
        {expanded && <span className="text-sm font-medium">{label}</span>}
      </button>

      {isOpen && DropdownComponent && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 z-50 min-w-[280px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
        >
          <DropdownComponent {...dropdownProps} onClose={handleCloseDropdown} />
        </div>
      )}
    </div>
  );
}
