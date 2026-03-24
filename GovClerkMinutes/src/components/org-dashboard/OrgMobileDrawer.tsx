import React, { useMemo } from "react";
import { useRouter } from "next/router";
import { HiXMark } from "react-icons/hi2";
import { TbLayoutSidebarRightExpandFilled } from "react-icons/tb";
import IconWordmark from "@/components/IconWordmark";
import { ORG_SIDEBAR_ITEMS, SidebarSection } from "./constants";
import { OrgSidebarItem } from "./OrgSidebarItem";
import { useSession } from "@clerk/nextjs";

interface OrgMobileDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly className?: string;
}

export function OrgMobileDrawer({
  isOpen,
  onClose,
  className = "",
}: Readonly<OrgMobileDrawerProps>) {
  const router = useRouter();
  const { session, isLoaded } = useSession();

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

    if (href === "/a") {
      return currentPath === "/a" || currentPath === "/a/";
    }
    if (currentPath.startsWith(href)) {
      const remainingPath = currentPath.slice(href.length);
      return remainingPath === "" || remainingPath.startsWith("/");
    }
    return false;
  };

  const handleItemClick = () => {
    onClose();
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-foreground/50 z-40 md:hidden border-0 cursor-default"
          onClick={onClose}
          aria-label="Close drawer"
        />
      )}

      <div
        className={`
        fixed left-0 top-0 h-screen w-72 bg-[#D4F6FF] border-r border-black/20
        transition-transform duration-300 ease-in-out z-50 flex flex-col md:hidden overflow-hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        ${className}
      `}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <IconWordmark />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors duration-200"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {itemsBySection.map(({ section, items }) => (
            <div key={section ?? "none"}>
              {section && (
                <div className="px-3 pt-4 pb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {section}
                  </span>
                </div>
              )}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={handleItemClick}
                  className="w-full text-left bg-transparent border-0 p-0"
                >
                  <OrgSidebarItem
                    item={item}
                    isExpanded
                    isActive={isActiveRoute(item.href)}
                    isPlaceholder={item.isPlaceholder}
                  />
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="px-3 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors duration-200"
            aria-label="Collapse sidebar"
          >
            <TbLayoutSidebarRightExpandFilled className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
