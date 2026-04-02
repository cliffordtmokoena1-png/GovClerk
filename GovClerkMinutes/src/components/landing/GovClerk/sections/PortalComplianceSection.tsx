import { LuShield, LuEye, LuLock, LuFileCheck } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

const badges = [
  {
    icon: LuFileCheck,
    title: "POPIA Compliant",
    description:
      "Fully compliant with South Africa's Protection of Personal Information Act — your citizens' data is handled lawfully and securely",
  },
  {
    icon: LuShield,
    title: "SOC 2 Type II",
    description:
      "Independently audited security controls for enterprise-grade data protection and organizational accountability",
  },
  {
    icon: LuEye,
    title: "WCAG 2.1 AA",
    description:
      "Accessible public records for all community members, including those with disabilities — meeting global accessibility standards",
  },
  {
    icon: LuLock,
    title: "AES-256 Encryption",
    description:
      "End-to-end encryption for all meeting recordings, transcripts, documents, and data stored on GovClerk Portal",
  },
];

export default function PortalComplianceSection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-cd-blue">
              Security & Compliance
            </p>
            <h2 className="font-serif text-3xl font-normal text-gray-800 md:text-5xl leading-[1.1]">
              Built for Public Sector Standards
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 md:text-lg">
              GovClerk Portal meets the security, privacy, and accessibility requirements that
              government organizations must comply with.
            </p>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge, index) => {
            const IconComponent = badge.icon;
            return (
              <FadeContent key={badge.title} direction="up" duration={0.5} delay={index * 0.1}>
                <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center transition-shadow hover:shadow-md">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-cd-blue/10">
                    <IconComponent className="h-7 w-7 text-cd-blue" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{badge.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{badge.description}</p>
                </div>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </section>
  );
}
