import React from "react";
import Link from "next/link";
import { OrgSidebarItem as OrgSidebarItemTypeInterface } from "./constants";

interface OrgSidebarItemProps {
  readonly item: OrgSidebarItemTypeInterface;
  readonly isExpanded: boolean;
  readonly isActive: boolean;
  readonly isPlaceholder?: boolean;
}

function getButtonClasses(isActive: boolean, isPlaceholder?: boolean): string {
  const baseClasses =
    "w-full flex items-center justify-start py-1.5 my-0.5 text-sm font-medium pl-1.5 pr-2 relative border-2";

  if (isActive) {
    return `${baseClasses} bg-white text-card-foreground rounded-l-lg border-primary/30 border-r-0`;
  }
  if (isPlaceholder) {
    return `${baseClasses} text-muted-foreground cursor-not-allowed rounded-lg border-transparent`;
  }
  return `${baseClasses} text-foreground/80 hover:bg-black/20 rounded-lg border-transparent`;
}

export function OrgSidebarItem({
  item,
  isExpanded,
  isActive,
  isPlaceholder,
}: Readonly<OrgSidebarItemProps>) {
  const Icon = item.icon;
  const buttonClasses = getButtonClasses(isActive, isPlaceholder);

  const content = (
    <>
      <Icon className="w-5 h-5 shrink-0 relative z-10" />
      <span
        className={`ml-3 whitespace-nowrap transition-opacity duration-200 relative z-10 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}
      >
        {item.label}
      </span>
    </>
  );

  return (
    <div className="relative group">
      {/* Active item extension to create seamless merge - overlaps content border */}
      {isActive && (
        <div className="absolute right-[2px] translate-x-full top-0 bottom-0 w-[12px] z-50 overflow-hidden">
          <div className="w-full h-full bg-white border-y-2 border-primary/30" />
        </div>
      )}

      {isPlaceholder ? (
        <button disabled className={buttonClasses}>
          {content}
        </button>
      ) : (
        <Link href={item.href} className={buttonClasses}>
          {content}
        </Link>
      )}

      {/* Enhanced tooltip for collapsed state */}
      {!isExpanded && (
        <div
          className="
            fixed left-12 ml-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium
            rounded-md shadow-lg
            opacity-0 invisible group-hover:opacity-100 group-hover:visible
            transition-all duration-200 ease-out
            pointer-events-none whitespace-nowrap z-9999
            translate-x-0 group-hover:translate-x-1
            -translate-y-9
          "
          style={{
            top: "auto",
          }}
        >
          {item.label}
          {isPlaceholder && " (Coming soon)"}
          {/* Tooltip arrow */}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-0 h-0 border-t-2 border-b-2 border-r-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );
}
