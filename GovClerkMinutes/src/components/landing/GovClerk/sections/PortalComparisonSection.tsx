import { LuCheck, LuX } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

type ComparisonRow = {
  feature: string;
  govclerk: string | boolean;
  idms: string | boolean;
  civicplus: string | boolean;
};

const rows: ComparisonRow[] = [
  {
    feature: "Starting Price",
    govclerk: "R2,500/month",
    idms: "R5,000+/month",
    civicplus: "$8,000+/year",
  },
  { feature: "AI-Generated Minutes", govclerk: true, idms: false, civicplus: false },
  { feature: "Live Streaming", govclerk: true, idms: false, civicplus: true },
  { feature: "Real-Time Transcription", govclerk: true, idms: false, civicplus: false },
  { feature: "Setup Time", govclerk: "< 1 day", idms: "4–8 weeks", civicplus: "8–16 weeks" },
  { feature: "Built for Africa", govclerk: true, idms: true, civicplus: false },
  { feature: "Pay in ZAR", govclerk: true, idms: true, civicplus: false },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <LuCheck className="mx-auto h-5 w-5 text-green-400" />
    ) : (
      <LuX className="mx-auto h-5 w-5 text-red-400" />
    );
  }
  return <span className="text-sm font-medium text-white">{value}</span>;
}

export default function PortalComparisonSection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-cd-blue">
              How We Compare
            </p>
            <h2 className="font-serif text-3xl font-normal text-gray-800 md:text-5xl leading-[1.1]">
              GovClerk Portal vs the Competition
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
              The most affordable, AI-powered public portal for the African government market.
            </p>
          </div>
        </FadeContent>

        <FadeContent direction="up" duration={0.6} delay={0.1}>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-cd-navy">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Feature</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-cd-blue bg-blue-50/10">
                    GovClerk Portal ✨
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">
                    IDMS
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">
                    CivicPlus
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{row.feature}</td>
                    <td className="px-6 py-4 text-center bg-blue-50/50">
                      <CellValue value={row.govclerk} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.idms === "boolean" ? (
                        <CellValue value={row.idms} />
                      ) : (
                        <span className="text-sm text-gray-500">{row.idms}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.civicplus === "boolean" ? (
                        <CellValue value={row.civicplus} />
                      ) : (
                        <span className="text-sm text-gray-500">{row.civicplus}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
