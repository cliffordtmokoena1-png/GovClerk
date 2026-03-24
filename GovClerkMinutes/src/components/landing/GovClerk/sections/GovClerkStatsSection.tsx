import CountUp from "../../../reactbits/CountUp";
import FadeContent from "../../../reactbits/FadeContent";

type StatItem = {
  to: number;
  suffix: string;
  prefix: string;
  label: string;
};

const stats: StatItem[] = [
  { to: 80, suffix: "%", prefix: "", label: "Reduction in Minutes Prep Time" },
  { to: 96, suffix: "+", prefix: "", label: "Languages Supported" },
  { to: 500, suffix: "+", prefix: "", label: "Organizations Served" },
  { to: 1, suffix: " Day", prefix: "<", label: "Average Setup Time" },
];

export default function GovClerkStatsSection() {
  return (
    <section className="border-y border-white/10 bg-cd-navy py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-white md:text-4xl">
                  {stat.prefix}
                  <CountUp to={stat.to} duration={2.5} />
                  {stat.suffix}
                </p>
                <p className="mt-2 text-sm font-medium text-blue-200 md:text-base">{stat.label}</p>
              </div>
            ))}
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
