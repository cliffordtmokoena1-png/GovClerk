import { LuArrowRight } from "react-icons/lu";

export const GovClerk_ANNOUNCEMENT_BAR_HEIGHT = 40;

export default function GovClerkAnnouncementBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[101] flex items-center bg-cd-blue px-4 text-white sm:px-6"
      style={{ height: `${GovClerk_ANNOUNCEMENT_BAR_HEIGHT}px` }}
    >
      <div className="mx-auto w-full max-w-7xl overflow-hidden">
        <div className="flex items-center justify-center gap-2">
          <p className="truncate text-xs font-medium sm:text-sm">
            <span className="sm:hidden">GovClerk: AI meeting management for government.</span>
            <span className="hidden sm:inline">
              Introducing GovClerk: AI-powered meeting management for government organizations.
            </span>
          </p>
          <a
            href="#hero-form"
            className="hidden items-center gap-1 shrink-0 whitespace-nowrap text-sm font-semibold text-white underline underline-offset-2 hover:opacity-90 sm:inline-flex"
          >
            Learn more
            <LuArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
