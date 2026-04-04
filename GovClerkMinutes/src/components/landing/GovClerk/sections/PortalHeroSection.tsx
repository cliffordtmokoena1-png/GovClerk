import Link from "next/link";
import FadeContent from "../../../reactbits/FadeContent";
import DotPattern from "../DotPattern";

export default function PortalHeroSection() {
  return (
    <section className="relative flex min-h-[90vh] items-center bg-white py-20">
      <div className="pointer-events-none absolute inset-0 bg-white" />
      <DotPattern dotColor="rgba(0,0,0,0.10)" fadeFrom="center" className="!bottom-auto h-[60%]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center">
        <FadeContent direction="up" duration={0.6}>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-cd-blue">
            Public Transparency Portal
          </p>
          <h1 className="font-serif text-4xl font-normal leading-[1.1] text-gray-800 md:text-6xl lg:text-7xl">
            Your Community&apos;s Front Door to Public Records
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl">
            GovClerk Portal gives your organization a branded, secure public portal where citizens
            can access meeting records, agendas, live broadcasts, and official documents — all
            verified through organizational email access. No more FOIA requests for information that
            should be public.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/portal/request-quote"
              className="rounded-lg bg-cd-blue px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-cd-blue-dark hover:shadow-md"
            >
              Request a Quote →
            </Link>
            <Link
              href="/portal/govclerkminutes"
              className="rounded-lg border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
            >
              Visit Public Portal →
            </Link>
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
