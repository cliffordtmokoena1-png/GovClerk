import React from "react";

export type MeetingTab = "details" | "agenda" | "documents" | "minutes";

interface MeetingTabsProps {
  activeTab: MeetingTab;
  onTabChange: (tab: MeetingTab) => void;
  rightContent?: React.ReactNode;
}

const tabs: { id: MeetingTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "agenda", label: "Agenda" },
  { id: "documents", label: "Documents" },
  { id: "minutes", label: "Minutes" },
];

export function MeetingTabs({ activeTab, onTabChange, rightContent }: Readonly<MeetingTabsProps>) {
  return (
    <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="flex items-center justify-between px-4">
        <nav className="flex -mb-px overflow-x-auto scrollbar-hide" aria-label="Meeting tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 transition-colors
                  ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {rightContent && (
          <div className="flex items-center gap-2 ml-4 shrink-0">{rightContent}</div>
        )}
      </div>
    </div>
  );
}
