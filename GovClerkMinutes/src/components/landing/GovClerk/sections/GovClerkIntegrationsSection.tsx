import FadeContent from "../../../reactbits/FadeContent";
import {
  SiZoom,
  SiMicrosoftteams,
  SiGooglemeet,
  SiSlack,
  SiMicrosoftword,
  SiGoogledocs,
  SiDropbox,
  SiMicrosoftonedrive,
} from "react-icons/si";

const integrations = [
  { name: "Zoom", icon: SiZoom },
  { name: "Microsoft Teams", icon: SiMicrosoftteams },
  { name: "Google Meet", icon: SiGooglemeet },
  { name: "Slack", icon: SiSlack },
  { name: "Microsoft Word", icon: SiMicrosoftword },
  { name: "Google Docs", icon: SiGoogledocs },
  { name: "Dropbox", icon: SiDropbox },
  { name: "OneDrive", icon: SiMicrosoftonedrive },
];

export default function GovClerkIntegrationsSection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-300">
              Integrations
            </p>
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              Connects With the Tools You Already Use
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-blue-200 md:text-lg">
              GovClerk integrates with leading conferencing, collaboration, and storage platforms so
              your team can work without switching contexts.
            </p>
          </div>
        </FadeContent>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {integrations.map((integration, index) => {
            const IconComponent = integration.icon;
            return (
              <FadeContent
                key={integration.name}
                direction="up"
                duration={0.4}
                delay={index * 0.05}
              >
                <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition-all hover:border-white/20 hover:bg-white/10 hover:shadow-sm">
                  <IconComponent className="h-8 w-8 text-white/70" />
                  <span className="text-center text-xs font-medium text-white/70">
                    {integration.name}
                  </span>
                </div>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </section>
  );
}
