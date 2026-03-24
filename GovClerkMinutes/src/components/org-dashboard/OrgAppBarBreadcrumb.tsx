import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { HiChevronRight, HiEllipsisHorizontal } from "react-icons/hi2";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface OrgAppBarBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function OrgAppBarBreadcrumb({ items }: Readonly<OrgAppBarBreadcrumbProps>) {
  const router = useRouter();

  if (items.length === 0) {
    return null;
  }

  const handleEllipsisClick = () => {
    router.back();
  };

  return (
    <nav className="flex items-center min-w-0">
      <div className="flex items-center min-w-0 md:hidden">
        {items.length > 1 && (
          <>
            <button
              onClick={handleEllipsisClick}
              className="p-1 -ml-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
              aria-label="Go back"
            >
              <HiEllipsisHorizontal className="w-5 h-5" />
            </button>
            <HiChevronRight className="w-4 h-4 text-muted-foreground/60 mx-1 shrink-0" />
          </>
        )}
        <span className="text-base font-semibold text-foreground/90 truncate">
          {items[items.length - 1].label}
        </span>
      </div>

      <ol className="hidden md:flex items-center gap-1 min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = item.href && !isLast;

          return (
            <li key={item.href || item.label} className="flex items-center min-w-0">
              {index > 0 && (
                <HiChevronRight className="w-4 h-4 text-muted-foreground/60 mx-1 shrink-0" />
              )}
              {isClickable ? (
                <Link
                  href={item.href!}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`truncate max-w-[300px] ${
                    isLast
                      ? "text-base font-semibold text-foreground/90"
                      : "text-sm text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
