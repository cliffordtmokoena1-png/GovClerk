import React, { useRef } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useOrgContext } from "@/contexts/OrgContext";

interface OrgAccountButtonProps {
  readonly isExpanded: boolean;
  readonly className?: string;
}

export function OrgAccountButton({ isExpanded, className = "" }: Readonly<OrgAccountButtonProps>) {
  const { user } = useUser();
  const { mode, orgName } = useOrgContext();
  const userButtonRef = useRef<HTMLDivElement>(null);

  if (!user) {
    return null;
  }

  const displayName = user.firstName || user.username || "User";

  const handleContainerClick = () => {
    const button = userButtonRef.current?.querySelector("button");
    if (button) {
      button.click();
    }
  };

  return (
    <button
      type="button"
      onClick={handleContainerClick}
      className={`
        w-full flex items-center justify-start py-1 px-1.5 text-foreground rounded-lg transition-all duration-200
        hover:bg-accent cursor-pointer overflow-hidden border-0 bg-transparent
        ${className}
      `}
    >
      <span
        ref={userButtonRef}
        className="shrink-0 flex items-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <UserButton
          userProfileUrl="/a/account"
          userProfileMode="navigation"
          appearance={{
            elements: {
              avatarBox: {
                width: "24px",
                height: "24px",
              },
              userButtonTrigger: {
                padding: 0,
                border: "none",
                boxShadow: "none",
                "&:focus": {
                  boxShadow: "none",
                },
              },
            },
          }}
        />
      </span>

      <span
        className={`ml-3 text-left pointer-events-none whitespace-nowrap overflow-hidden transition-opacity duration-200 ${isExpanded ? "opacity-100" : "opacity-0 w-0"}`}
      >
        <span className="text-sm font-medium text-foreground truncate block">{displayName}</span>
        {mode === "org" && orgName && (
          <span className="text-xs text-muted-foreground truncate block">{orgName}</span>
        )}
      </span>
    </button>
  );
}
