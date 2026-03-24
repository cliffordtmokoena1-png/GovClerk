import React, { useMemo } from "react";
import { useRouter } from "next/router";
import {
  TbLayoutSidebarRightCollapseFilled,
  TbLayoutSidebarRightExpandFilled,
} from "react-icons/tb";
import Icon from "@/components/Icon";
import IconWordmark from "@/components/IconWordmark";
import { useOrgSidebar } from "./hooks/useOrgSidebar";
import { ORG_SIDEBAR_ITEMS, SidebarSection } from "./constants";
import { OrgSidebarItem } from "./OrgSidebarItem";
import { useSession } from "@clerk/nextjs";

interface OrgSidebarProps {
  readonly className?: string;
  readonly isExpanded?: boolean;
  readonly toggleSidebar?: () => void;
}

export function OrgSidebar({
  className = "",
  isExpanded: isExpandedProp,
  toggleSidebar: toggleSidebarProp,
}: Readonly<OrgSidebarProps>) {
  const router = useRouter();
  const { session, isLoaded } = useSession();
  const { isExpanded: isExpandedFromHook, toggleSidebar: toggleSidebarFromHook } = useOrgSidebar();
  const isExpanded = isExpandedProp ?? isExpandedFromHook;
  const toggleSidebar = toggleSidebarProp ?? toggleSidebarFromHook;

  const isAdmin = isLoaded && session?.user?.publicMetadata?.role === "admin";

  const filteredItems = useMemo(() => {
    return ORG_SIDEBAR_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  }, [isAdmin]);

  const itemsBySection = useMemo(() => {
    const sections: { section: SidebarSection; items: typeof filteredItems }[] = [];
    let currentSection: SidebarSection | undefined;

    for (const item of filteredItems) {
      const itemSection = item.section ?? null;
      if (itemSection === currentSection) {
        sections.at(-1)!.items.push(item);
      } else {
        sections.push({ section: itemSection, items: [item] });
        currentSection = itemSection;
      }
    }

    return sections;
  }, [filteredItems]);

  const isActiveRoute = (href: string) => {
    const currentPath = router.asPath.split("?")[0];

    if (currentPath.startsWith(href)) {
      const remainingPath = currentPath.slice(href.length);
      return remainingPath === "" || remainingPath.startsWith("/");
    }
    return false;
  };

  return (
    <div
      className={`
        h-screen shrink-0 overflow-visible
        transition-all duration-300 ease-in-out flex flex-col
        ${isExpanded ? "w-60" : "w-13"}
        ${className}
      `}
    >
      <div className="flex items-center h-12 px-2.5 justify-start">
        {isExpanded ? (
          <button
            onClick={toggleSidebar}
            className="hover:opacity-80 transition-opacity shrink-0 flex items-center justify-center h-10"
          >
            <IconWordmark />
          </button>
        ) : (
          <button
            onClick={toggleSidebar}
            className="hover:opacity-80 transition-opacity shrink-0 flex items-center justify-center w-8 h-10"
          >
            <Icon />
          </button>
        )}
      </div>

      <div className="flex-1 py-2 px-2 overflow-visible relative">
        {itemsBySection.map(({ section, items }) => (
          <div key={section ?? "none"}>
            {items.map((item) => (
              <OrgSidebarItem
                key={item.id}
                item={item}
                isExpanded={isExpanded}
                isActive={isActiveRoute(item.href)}
                isPlaceholder={item.isPlaceholder}
              />
            ))}
          </div>
        ))}
      </div>

      <div className={`py-2 px-2 mb-2 ${isExpanded ? "flex justify-end" : "flex justify-center"}`}>
        <button
          onClick={toggleSidebar}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-black/20 rounded-lg transition-colors duration-200"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <TbLayoutSidebarRightExpandFilled className="w-5 h-5" />
          ) : (
            <TbLayoutSidebarRightCollapseFilled className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
