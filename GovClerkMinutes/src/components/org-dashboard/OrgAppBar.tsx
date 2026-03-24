import React from "react";
import { HiBars3, HiXMark } from "react-icons/hi2";
import { UserButton } from "@clerk/nextjs";
import { useOrgAppBar } from "./context/OrgAppBarContext";
import { OrgAppBarActionButton } from "./OrgAppBarActionButton";

interface OrgAppBarProps {
  readonly defaultTitle?: string;
  readonly leftComponent?: React.ReactNode;
  readonly rightContent?: React.ReactNode;
  readonly onMenuClick: () => void;
  readonly isMobileDrawerOpen?: boolean;
  readonly className?: string;
}

export function OrgAppBar({
  defaultTitle = "Dashboard",
  leftComponent,
  rightContent,
  onMenuClick,
  isMobileDrawerOpen = false,
  className = "",
}: Readonly<OrgAppBarProps>) {
  const { title, actions } = useOrgAppBar();
  // Context title of null means "use default", any other value is explicit
  const displayTitle = title !== null ? title : defaultTitle;
  const hasRightSection = actions.length > 0 || rightContent;

  return (
    <div
      className={`
      fixed top-0 left-0 right-0 h-12 bg-transparent
      flex items-center px-3 z-30 md:hidden
      ${className}
    `}
    >
      <button
        onClick={onMenuClick}
        className="p-2 text-foreground/80 hover:text-foreground hover:bg-accent rounded-lg transition-colors duration-200"
      >
        {isMobileDrawerOpen ? <HiXMark className="w-5 h-5" /> : <HiBars3 className="w-5 h-5" />}
      </button>

      <div className="flex-1 min-w-0">
        {leftComponent ??
          (typeof displayTitle === "string" ? (
            <h1 className="text-base font-semibold text-foreground/90 truncate">{displayTitle}</h1>
          ) : (
            displayTitle
          ))}
      </div>

      {hasRightSection && <div className="h-6 w-px bg-foreground/20 mx-2" />}

      {rightContent}

      <UserButton
        userProfileUrl="/a/account"
        userProfileMode="navigation"
        appearance={{
          elements: {
            avatarBox: "w-6 h-6",
            userButtonTrigger: "p-0 border-none shadow-none focus:shadow-none",
          },
        }}
      />

      {actions.length > 0 && (
        <div className="flex items-center gap-1 ml-2">
          {actions.map((action) => (
            <OrgAppBarActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
