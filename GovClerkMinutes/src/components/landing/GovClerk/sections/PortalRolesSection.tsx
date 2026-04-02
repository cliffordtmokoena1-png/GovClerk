import { LuFileText, LuUsers, LuServer } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

const roles = [
  {
    icon: LuFileText,
    title: "Municipal Clerks & Records Officers",
    description:
      "Eliminate the phone calls, email requests, and manual document distribution. GovClerk Portal auto-publishes meeting records, agendas, and minutes the moment they're approved — keeping your community informed without adding to your workload.",
    highlight: "70% fewer public records requests",
  },
  {
    icon: LuUsers,
    title: "Council Members & Board Directors",
    description:
      "Give your community real-time access to the decisions being made on their behalf. Live broadcasts, searchable transcripts, and a permanent record of every vote ensure your council meets the highest standards of public accountability.",
    highlight: "100% open meeting law compliance",
  },
  {
    icon: LuServer,
    title: "IT Directors & Municipal Managers",
    description:
      "Deploy a POPIA-compliant, SOC 2 certified platform with organizational email-based access control. No on-premise infrastructure, no complex integrations — GovClerk Portal is up and running in less than a day.",
    highlight: "Zero infrastructure to maintain",
  },
];

export default function PortalRolesSection() {
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
              Whether you manage the records, run the council, or maintain the infrastructure,
              GovClerk Portal fits your workflow.
            </p>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {roles.map((role, index) => {
            const IconComponent = role.icon;
            return (
              <FadeContent key={role.title} direction="up" duration={0.5} delay={index * 0.1}>
                <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors hover:bg-white/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{role.title}</h3>
                  <p className="flex-1 text-sm leading-relaxed text-blue-100">{role.description}</p>
                  <p className="text-sm font-semibold text-blue-300">{role.highlight}</p>
                </div>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </section>
  );
}
