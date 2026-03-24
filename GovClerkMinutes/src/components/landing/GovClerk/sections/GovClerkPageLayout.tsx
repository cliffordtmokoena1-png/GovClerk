import { ReactNode } from "react";
import GovClerkNavBar from "./GovClerkNavBar";
import GovClerkFooter from "./GovClerkFooter";
import GovClerkAnnouncementBar from "./GovClerkAnnouncementBar";

type Props = {
  children: ReactNode;
};

export default function GovClerkPageLayout({ children }: Props) {
  return (
    <div className="relative min-h-screen pt-10">
      <GovClerkAnnouncementBar />
      <GovClerkNavBar />
      <div className="flex flex-col">{children}</div>
      <GovClerkFooter />
    </div>
  );
}
