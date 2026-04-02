import FadeContent from "../../../reactbits/FadeContent";

const stats = [
  { value: "70%", label: "Reduction in Public Records Requests" },
  { value: "24/7", label: "Citizen Access to Meeting Records" },
  { value: "< 5 min", label: "From Meeting End to Public Availability" },
  { value: "100%", label: "Open Meeting Law Compliance" },
];

export default function PortalStatsSection() {
  return (
    <section className="border-y border-white/10 bg-cd-navy py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-white md:text-4xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-blue-200 md:text-base">{stat.label}</p>
              </div>
            ))}
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
