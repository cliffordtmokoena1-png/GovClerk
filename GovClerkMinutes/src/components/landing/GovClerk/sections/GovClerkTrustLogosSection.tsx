import FadeContent from "../../../reactbits/FadeContent";

const trustedOrgs = [
  { name: "New York County, NY", initials: "NY" },
  { name: "Washington, DC", initials: "DC" },
  { name: "Dubai Municipality", initials: "DM" },
  { name: "City of Cape Town", initials: "CT" },
  { name: "City of Pretoria", initials: "CP" },
  { name: "City of Johannesburg", initials: "CJ" },
  { name: "eThekwini (Durban)", initials: "ED" },
  { name: "Mangaung (Bloemfontein)", initials: "MB" },
  { name: "Nelson Mandela Bay (Gqeberha)", initials: "NM" },
  { name: "Brooklyn Borough, NY", initials: "BB" },
];

export default function GovClerkTrustLogosSection() {
  return (
    <section className="border-y border-white/10 bg-cd-navy py-8 md:py-10">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.5}>
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-blue-300">
            Trusted by 500+ government agencies and public organizations
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
            {trustedOrgs.map((org) => (
              <div
                key={org.name}
                className="flex items-center gap-2 opacity-50 grayscale transition-all hover:opacity-80 hover:grayscale-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                  {org.initials}
                </div>
                <span className="hidden text-sm font-medium text-white/70 sm:inline">
                  {org.name}
                </span>
              </div>
            ))}
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
