import { useRef, useState } from "react";
import { FaStar } from "react-icons/fa";
import {
  LuBuilding2,
  LuGraduationCap,
  LuHeart,
  LuLandmark,
  LuSchool,
  LuUsers,
} from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

type Testimonial = {
  name: string;
  role: string;
  organization: string;
  text: string;
};

const testimonials: Testimonial[] = [
  {
    name: "Sarah Mitchell, CMC",
    role: "City Clerk",
    organization: "New York County, NY",
    text: "GovClerk cut our minutes preparation time by 80%. What used to take two full days now takes less than an hour. The AI accuracy is remarkable, and our council members love having searchable transcripts.",
  },
  {
    name: "James Thornton",
    role: "Board Secretary",
    organization: "Washington, DC Public Schools",
    text: "We needed a solution that met open meeting compliance requirements out of the box. GovClerk delivers that and more. The public portal alone saved us from three separate software subscriptions.",
  },
  {
    name: "Fatima Al-Rashid",
    role: "Executive Director",
    organization: "Dubai Community Foundation",
    text: "Our board meetings are more productive now that we can focus on discussion instead of note-taking. The automated minutes capture every vote and action item without fail.",
  },
  {
    name: "Thabo Mokoena, MPA",
    role: "Municipal Manager",
    organization: "City of Cape Town, South Africa",
    text: "The ROI was immediate. We eliminated overtime costs for manual transcription and improved public trust with transparent, accessible meeting records. Implementation took less than a week.",
  },
  {
    name: "Naledi Khumalo",
    role: "Legislative Analyst",
    organization: "City of Johannesburg, South Africa",
    text: "The speaker identification feature is a game changer for our large council sessions. No more guessing who said what. Every motion and vote is tracked automatically.",
  },
  {
    name: "Lerato Dlamini, MMC",
    role: "Deputy City Clerk",
    organization: "City of Pretoria, South Africa",
    text: "Transitioning from manual transcription was seamless. The onboarding team walked us through every step, and we were live within three days. Our staff actually enjoys the meeting workflow now.",
  },
];

const usedByOrgs = [
  { name: "Municipal Governments", icon: LuLandmark },
  { name: "School Districts", icon: LuSchool },
  { name: "County Councils", icon: LuBuilding2 },
  { name: "Nonprofit Boards", icon: LuHeart },
  { name: "Planning Commissions", icon: LuUsers },
  { name: "Higher Education", icon: LuGraduationCap },
];

function StarRating() {
  return (
    <div className="flex gap-1 text-yellow-400">
      {[...Array(5)].map((_, i) => (
        <FaStar key={i} className="h-4 w-4" />
      ))}
    </div>
  );
}

export default function GovClerkTestimonialsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate items in JSX instead of DOM cloning
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="overflow-hidden bg-cd-navy py-16 md:py-24">
      {/* Section header */}
      <div className="mx-auto mb-12 max-w-7xl px-6 text-center">
        <FadeContent direction="up" duration={0.6}>
          <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
            Trusted by Organizations Across the Globe
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-blue-200 md:text-lg">
            See what clerks, administrators, and board secretaries are saying about GovClerk.
          </p>
        </FadeContent>
      </div>

      {/* Scrollable testimonials carousel */}
      <div
        className="relative overflow-hidden py-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div
          ref={scrollRef}
          className="flex w-max items-stretch gap-4"
          style={{
            animation: "cdScrollTestimonials 60s linear infinite",
            animationPlayState: isPaused ? "paused" : "running",
          }}
        >
          {duplicatedTestimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.name}-${index}`}
              className="flex min-w-[280px] max-w-[280px] flex-col rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:-translate-y-0.5 hover:shadow-lg md:min-w-[350px] md:max-w-[350px]"
            >
              <div className="flex flex-1 flex-col gap-4">
                <StarRating />
                <p className="text-sm leading-relaxed text-white/80">
                  &ldquo;{testimonial.text}&rdquo;
                </p>
                <div className="mt-auto space-y-0 pt-2">
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-white/50">
                    {testimonial.role}, {testimonial.organization}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Used by organizations section */}
      <div className="mx-auto mt-16 max-w-7xl px-6 md:mt-20">
        <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-white/40">
          Used by organizations like
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {usedByOrgs.map((org) => {
            const IconComponent = org.icon;
            return (
              <div
                key={org.name}
                className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/20 hover:bg-white/10"
              >
                <IconComponent className="h-8 w-8 text-blue-300" />
                <span className="text-center text-xs font-medium text-white/70">{org.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
