import FadeContent from "../../../reactbits/FadeContent";

type FeatureBlock = {
  title: string;
  description: string;
  imageUrl: string;
};

type Props = {
  features: FeatureBlock[];
};

export default function GovClerkFeatureDetailSection({ features }: Props) {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-20 md:gap-28">
          {features.map((feature, index) => {
            const isReversed = index % 2 === 1;
            return (
              <FadeContent key={feature.title} direction="up" delay={0.1} duration={0.7}>
                <div
                  className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
                    isReversed ? "md:[direction:rtl]" : ""
                  }`}
                >
                  <div className={isReversed ? "md:[direction:ltr]" : ""}>
                    <h3 className="font-serif text-2xl font-normal leading-[1.2] text-gray-800 md:text-3xl">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-base leading-[1.8] text-gray-600 md:text-lg">
                      {feature.description}
                    </p>
                  </div>
                  <div className={isReversed ? "md:[direction:ltr]" : ""}>
                    <img
                      src={feature.imageUrl}
                      alt={feature.title}
                      width={600}
                      height={400}
                      className="aspect-[3/2] w-full rounded-xl object-cover shadow-md"
                      loading="lazy"
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
