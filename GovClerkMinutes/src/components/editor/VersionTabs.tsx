import { LuPin, LuCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";

type VersionTabsProps = {
  versions: string[];
  selectedVersion: number;
  onVersionChange: (index: number) => void;
  pinnedVersion?: number;
  onPinVersion?: (version: number) => void;
  isPinning?: boolean;
  disabled?: boolean;
  className?: string;
};

export function VersionTabs({
  versions,
  selectedVersion,
  onVersionChange,
  pinnedVersion,
  onPinVersion,
  isPinning = false,
  disabled = false,
  className = "",
}: VersionTabsProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {versions.map((_, index) => {
        const versionNum = index + 1;
        const isPinned = pinnedVersion === versionNum;

        return (
          <Button
            key={index}
            onClick={() => onVersionChange(index)}
            variant={selectedVersion === index ? "default" : "ghost"}
            size="sm"
            disabled={disabled}
            className="h-7 px-2.5 text-xs"
          >
            {isPinned && <LuCheck className="w-3 h-3 mr-1 text-green-500" />}v{versionNum}
          </Button>
        );
      })}
    </div>
  );
}
