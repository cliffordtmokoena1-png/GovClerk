import Link from "next/link";
import FadeContent from "../../../reactbits/FadeContent";
import DotPattern from "../DotPattern";

type Props = {
  label: string;
  title: string;
  description: string;
  imageUrl?: string;
};

export default function GovClerkSubPageHero({ label, title, description, imageUrl }: Props) {
  return (
    <section className="relative overflow-hidden bg-white py-16 md:py-24">
      <DotPattern dotColor="rgba(0,0,0,0.08)" dotSize={1.2} gap={24} fadeFrom="edges" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <FadeContent direction="up" duration={0.7}>
            <div className="flex flex-col gap-5">
              <span className="text-sm font-semibold uppercase tracking-wider text-cd-blue">
                {label}
              </span>
              <h1 className="font-serif text-3xl font-normal leading-[1.1] text-gray-800 sm:text-4xl md:text-5xl">
                {title}
              </h1>
              <p className="max-w-lg text-base leading-[1.8] text-gray-600 md:text-lg">
                {description}
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4">
                <a
                  href="#hero-form"
                  className="rounded-lg bg-cd-blue px-8 py-3 text-center text-base font-semibold text-white transition-all hover:bg-cd-blue-dark hover:shadow-md"
                >
                  Book a Demo
                </a>
                <Link
                  href="/overview"
                  className="rounded-lg border border-cd-blue px-8 py-3 text-center text-base font-semibold text-cd-blue transition-all hover:bg-blue-50"
                >
                  Watch Overview
                </Link>
              </div>
            </div>
          </FadeContent>

          {imageUrl && (
            <FadeContent direction="up" delay={0.2} duration={0.7}>
              <div className="flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt={title}
                  width={600}
                  height={400}
                  className="aspect-[3/2] w-full max-w-md rounded-xl object-cover shadow-lg"
                  loading="eager"
                />
              </div>
            </FadeContent>
          )}
        </div>
      </div>
    </section>
  );
}
