import { LuLock, LuShield, LuEye, LuUsers } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

const badges = [
  {
    icon: LuShield,
    title: "SOC 2 Type II",
    description: "Independently audited security controls for enterprise data protection",
  },
  {
    icon: LuEye,
    title: "WCAG 2.1 AA",
    description:
      "Accessible meeting records for all community members, including those with disabilities",
  },
  {
    icon: LuLock,
    title: "AES-256 Encryption",
    description:
      "End-to-end encryption for meeting recordings, transcripts, and all stored documents",
  },
  {
    icon: LuUsers,
    title: "Role-Based Access",
    description:
      "Granular permissions ensure only authorized staff can view, edit, or publish records",
  },
];

export default function GovClerkComplianceSection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-200">
              Security & Compliance
            </p>
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              Built for Public Sector Standards
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-blue-100 md:text-lg">
              GovClerk meets the security and accessibility requirements that government
              organizations demand. Your data is protected at every level.
            </p>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge, index) => {
            const IconComponent = badge.icon;
            return (
              <FadeContent key={badge.title} direction="up" duration={0.5} delay={index * 0.1}>
                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center transition-shadow hover:shadow-md hover:bg-white/10">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
                    <IconComponent className="h-7 w-7 text-blue-300" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{badge.title}</h3>
                  <p className="text-sm leading-relaxed text-white/70">{badge.description}</p>
                </div>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </section>
  );
}
