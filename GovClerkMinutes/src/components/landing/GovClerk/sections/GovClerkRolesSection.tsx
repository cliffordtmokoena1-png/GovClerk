import Image from "next/image";
import { LuClipboardList, LuShieldCheck, LuServer } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

const roles = [
  {
    icon: LuClipboardList,
    title: "City & County Clerks",
    description:
      "Eliminate hours of manual transcription. GovClerk auto-generates minutes from recordings, tracks motions and votes, and publishes records to your public portal in the format your jurisdiction requires.",
    image: "/screenshots/desktop-v2.png",
    stats: "80% less time on minutes preparation",
  },
  {
    icon: LuShieldCheck,
    title: "Board Secretaries & Administrators",
    description:
      "Keep your board organized with automated agenda building, real-time collaboration, and a searchable archive of every meeting. Stay compliant with open meeting laws without the manual overhead.",
    image: "/screenshots/minutes-excerpt.png",
    stats: "100% compliance with open meeting requirements",
  },
  {
    icon: LuServer,
    title: "IT Directors & System Administrators",
    description:
      "Deploy a SOC 2 compliant platform with SSO integration, role-based access controls, and API connectivity to your existing systems. No on-premise infrastructure required.",
    image: "/screenshots/desktop-v2.png",
    stats: "Zero infrastructure to maintain",
  },
];

export default function GovClerkRolesSection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-200">
              Built for Your Role
            </p>
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              Purpose-Built for Every Stakeholder
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-blue-100 md:text-lg">
              Whether you manage the minutes, oversee the board, or run the IT infrastructure,
              GovClerk fits your workflow.
            </p>
          </div>
        </FadeContent>

        <div className="flex flex-col gap-12">
          {roles.map((role, index) => {
            const IconComponent = role.icon;
            const isReversed = index % 2 === 1;
            return (
              <FadeContent key={role.title} direction="up" duration={0.5} delay={index * 0.1}>
                <div
                  className={`grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12 ${
                    isReversed ? "md:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white md:text-2xl">{role.title}</h3>
                    <p className="text-base leading-relaxed text-blue-100">{role.description}</p>
                    <p className="text-sm font-semibold text-blue-200">{role.stats}</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/20 shadow-lg">
                    <Image
                      src={role.image}
                      alt={`${role.title} using GovClerk`}
                      width={600}
                      height={400}
                      className="h-auto w-full"
                    />
                  </div>
                </div>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </section>
  );
}
