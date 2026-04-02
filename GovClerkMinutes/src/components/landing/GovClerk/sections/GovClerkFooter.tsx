import Link from "next/link";
import Image from "next/image";
import { FaLinkedinIn, FaXTwitter, FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa6";
type FooterLink = { label: string; href: string };
const productLinks: FooterLink[] = [
  { label: "Agenda Management", href: "/a/meetings" },
  { label: "Minutes Generation", href: "/a/meetings" },
  { label: "Transcription", href: "/a/broadcast" },
  { label: "Votes & Motions", href: "/a/meetings" },
  { label: "GovClerk Portal", href: "/portal" },
  { label: "Portal Pricing", href: "/portal/request-quote" },
  { label: "All Features", href: "/a/dashboard" },
];
const solutionLinks: FooterLink[] = [
  { label: "Government", href: "/a/boards" },
  { label: "School Boards", href: "/a/boards" },
  { label: "Nonprofits", href: "/a/boards" },
  { label: "Committees", href: "/a/boards" },
];
const resourceLinks: FooterLink[] = [
  { label: "Documentation", href: "/a/dashboard" },
  { label: "Blog", href: "/a/dashboard" },
  { label: "Help Center", href: "/a/dashboard" },
  { label: "Case Studies", href: "/a/dashboard" },
];
const companyLinks: FooterLink[] = [
  { label: "About Us", href: "/a/dashboard" },
  { label: "Contact Us", href: "/a/dashboard" },
  { label: "Careers", href: "/a/dashboard" },
  { label: "Partners", href: "/a/dashboard" },
];
const socialIcons = [
  { icon: FaLinkedinIn, label: "LinkedIn", href: "https://linkedin.com/company/GovClerk" },
  { icon: FaXTwitter, label: "X (Twitter)", href: "https://x.com/GovClerk" },
  { icon: FaFacebookF, label: "Facebook", href: "https://facebook.com/GovClerk" },
  { icon: FaInstagram, label: "Instagram", href: "https://instagram.com/GovClerk" },
  { icon: FaYoutube, label: "YouTube", href: "https://youtube.com/@GovClerk" },
];
const legalLinks: FooterLink[] = [
  { label: "Privacy", href: "/privacy-policy.html" },
  { label: "Terms of Use", href: "/terms-of-use.html" },
  { label: "Acceptable Use", href: "/acceptable-use" },
  { label: "Status", href: "https://status.GovClerk.com" },
];
type FooterColumnProps = { title: string; links: FooterLink[] };
function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white">{title}</h3>
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="text-sm text-gray-300 transition-colors hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
export default function GovClerkFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-gray-950 pt-12 text-white md:pt-16">
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="mb-10 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-8">
          <div className="flex flex-col items-start gap-5">
            <Image
              src="/govclerk-logo.svg"
              alt="GovClerk"
              width={380}
              height={110}
              className="w-[220px] h-auto brightness-0 invert"
            />
            <p className="max-w-[260px] text-sm leading-relaxed text-gray-300">
              GovClerk is a product of GovClerkMinutes. We build tools that help organizations run
              better meetings.
            </p>
            <Link
              href="https://GovClerkMinutes.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 transition-colors hover:text-white"
            >
              Powered by GovClerkMinutes
            </Link>
            <div className="flex gap-3 pt-2">
              {socialIcons.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-gray-300 transition-all hover:bg-white/20 hover:text-white"
                  >
                    <IconComponent className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Solutions" links={solutionLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
        </div>
        <div className="mb-10 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-8">
          <div className="hidden md:block" />
          <FooterColumn title="Company" links={companyLinks} />
          <div className="flex flex-col gap-3 sm:col-span-1 md:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">Legal</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {legalLinks.map((link) => {
                const isExternal = link.href.startsWith("http") || link.href.endsWith(".html");
                if (isExternal) {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-sm text-gray-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-600" />
        <div className="flex items-center justify-between py-6">
          <p className="text-sm text-gray-400">
            &copy; {currentYear} GovClerk. All rights reserved.
          </p>
        </div>
      </div>
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center overflow-hidden"
        aria-hidden="true"
      >
        <p className="whitespace-nowrap font-serif text-[12rem] font-black leading-[0.75] tracking-wider text-white/[0.03] md:text-[20rem]">
          GovClerk
        </p>
      </div>
    </footer>
  );
}
