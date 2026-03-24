type FeatureBlock = {
  title: string;
  description: string;
  imageUrl: string;
};

export type GovClerkPageData = {
  slug: string;
  seo: {
    title: string;
    description: string;
  };
  hero: {
    label: string;
    title: string;
    description: string;
    imageUrl?: string;
  };
  features: FeatureBlock[];
};

export const GovClerkPages: GovClerkPageData[] = [
  {
    slug: "product",
    seo: {
      title: "All Features | GovClerk",
      description:
        "Explore the full suite of GovClerk features: agenda management, AI minutes generation, transcription, votes and motions, public portal, and more.",
    },
    hero: {
      label: "Product",
      title: "Everything You Need to Run Better Meetings",
      description:
        "From agenda creation to published minutes, GovClerk automates every step of your meeting workflow so your team can focus on decisions, not paperwork.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "AI-Powered Minutes Generation",
        description:
          "Upload a recording and let GovClerk produce structured, professional meeting minutes in seconds. Our AI identifies speakers, extracts action items, and formats everything to your organization's standards.",
        imageUrl: "/screenshots/minutes-excerpt.png",
      },
      {
        title: "Agenda Builder with Templates",
        description:
          "Create agendas from templates, reorder items with drag-and-drop, and distribute them digitally to all stakeholders before the meeting even starts.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Real-Time Transcription in 96+ Languages",
        description:
          "Capture every word with speaker-labeled transcription that works across languages. Searchable, timestamped, and ready for the public record.",
        imageUrl: "/screenshots/transcripts-excerpt.png",
      },
      {
        title: "Votes, Motions, and Resolutions",
        description:
          "Record roll-call votes, track motions through their lifecycle, and archive resolutions with full audit trails for compliance.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/agenda-management",
    seo: {
      title: "Agenda Management | GovClerk",
      description:
        "Create, organize, and distribute meeting agendas digitally. Drag-and-drop builder, templates, and stakeholder notifications built in.",
    },
    hero: {
      label: "Product",
      title: "Agenda Management That Keeps Everyone Prepared",
      description:
        "Build agendas in minutes, not hours. Use templates, drag-and-drop reordering, and automatic stakeholder notifications to ensure every meeting starts on the same page.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Template Library",
        description:
          "Start from pre-built agenda templates for council meetings, board sessions, committee reviews, and more. Customize once, reuse forever.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Drag-and-Drop Builder",
        description:
          "Reorder agenda items, nest sub-topics, and set time allocations with an intuitive visual editor that anyone on your team can use.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Automatic Distribution",
        description:
          "Notify board members, department heads, and the public when agendas are published. Integrated email and portal notifications keep everyone informed.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/minutes-generation",
    seo: {
      title: "AI Minutes Generation | GovClerk",
      description:
        "Transform meeting recordings into structured, professional minutes with AI. Speaker labels, action items, and compliance-ready formatting.",
    },
    hero: {
      label: "Product",
      title: "Meeting Minutes in Seconds, Not Hours",
      description:
        "Upload a recording and GovClerk produces formatted minutes with speaker attribution, action items, and key decisions. Review, edit, and publish from one place.",
      imageUrl: "/screenshots/minutes-excerpt.png",
    },
    features: [
      {
        title: "AI-Powered Drafting",
        description:
          "Our AI listens to your recordings and produces a structured draft with headers, speaker labels, timestamps, and extracted motions ready for your review.",
        imageUrl: "/screenshots/minutes-excerpt.png",
      },
      {
        title: "Action Item Extraction",
        description:
          "GovClerk automatically identifies action items, assigns them to speakers, and tracks completion status so nothing falls through the cracks.",
        imageUrl: "/screenshots/minutes-excerpt.png",
      },
      {
        title: "One-Click Publishing",
        description:
          "Export minutes as Word, PDF, or publish directly to your public portal. Formatting follows your organization's standards every time.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/transcription",
    seo: {
      title: "Meeting Transcription | GovClerk",
      description:
        "Real-time speech-to-text with speaker labels in 96+ languages. Searchable, timestamped transcripts for every meeting.",
    },
    hero: {
      label: "Product",
      title: "Accurate Transcription for Every Meeting",
      description:
        "Capture every word with speaker-labeled transcription that works in 96+ languages. Fully searchable, timestamped, and ready for the official record.",
      imageUrl: "/screenshots/transcripts-excerpt.png",
    },
    features: [
      {
        title: "96+ Language Support",
        description:
          "Transcribe meetings in English, Spanish, Mandarin, and dozens more. Multilingual meetings are handled seamlessly with automatic language detection.",
        imageUrl: "/screenshots/transcripts-excerpt.png",
      },
      {
        title: "Speaker Identification",
        description:
          "GovClerk labels who said what, making it easy to attribute statements, track discussion threads, and produce accurate meeting records.",
        imageUrl: "/screenshots/transcripts-excerpt.png",
      },
      {
        title: "Searchable Archives",
        description:
          "Full-text search across all your transcripts. Find any statement, decision, or discussion point from any meeting in seconds.",
        imageUrl: "/screenshots/transcripts-excerpt.png",
      },
    ],
  },
  {
    slug: "product/votes-and-motions",
    seo: {
      title: "Votes & Motions | GovClerk",
      description:
        "Record, track, and archive motions, roll-call votes, and resolutions with full audit trails for open meeting compliance.",
    },
    hero: {
      label: "Product",
      title: "Track Every Vote and Motion with Confidence",
      description:
        "From motion introduction to final resolution, GovClerk gives you a complete, auditable record of every vote your organization takes.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Roll-Call Voting",
        description:
          "Record individual member votes with timestamps. Support for voice votes, roll-call votes, and unanimous consent with automatic tally.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Motion Lifecycle Tracking",
        description:
          "Track motions from introduction through second, discussion, amendment, and final vote. Every state change is logged for the record.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Resolution Archive",
        description:
          "Maintain a searchable archive of all adopted resolutions with links to the meetings, votes, and discussions that produced them.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/organization-management",
    seo: {
      title: "Organization Management | GovClerk",
      description:
        "Manage boards, committees, departments, and member roles from one central hub. Role-based access and org-wide visibility.",
    },
    hero: {
      label: "Product",
      title: "One Hub for Your Entire Organization",
      description:
        "Manage boards, committees, departments, and member roles centrally. GovClerk gives every team the structure they need without the overhead.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Board and Committee Structure",
        description:
          "Define your organizational hierarchy with boards, sub-committees, and working groups. Each has its own meetings, agendas, and member lists.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Role-Based Access",
        description:
          "Control who can create agendas, approve minutes, publish to the portal, and manage members with granular role-based permissions.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Member Directory",
        description:
          "Maintain a central directory of all members across boards and committees with contact details, term dates, and attendance records.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/public-portal",
    seo: {
      title: "Public Portal | GovClerk",
      description:
        "Publish meeting records, agendas, minutes, and recordings for public transparency. Embeddable portal for your website.",
    },
    hero: {
      label: "Product",
      title: "Transparent Meetings, Open to the Public",
      description:
        "Publish agendas, minutes, recordings, and resolutions to a public-facing portal that meets open meeting requirements and builds community trust.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Automated Publishing",
        description:
          "Approved minutes and agendas are published to your portal automatically. No manual uploads, no forgotten updates.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Searchable Public Records",
        description:
          "Citizens can search agendas, minutes, and recordings by date, topic, or keyword. Full transparency without the filing cabinet.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Embeddable Widget",
        description:
          "Embed your meeting calendar and records directly into your existing government or organization website. No separate portal needed.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/security",
    seo: {
      title: "Security & Compliance | GovClerk",
      description:
        "SOC 2 Type II compliant meeting management with encryption, role-based access, and audit trails built for government requirements.",
    },
    hero: {
      label: "Product",
      title: "Enterprise Security Built for Government",
      description:
        "SOC 2 Type II certified with end-to-end encryption, role-based access controls, and complete audit trails. Built to meet the security requirements government organizations demand.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "SOC 2 Type II Certified",
        description:
          "GovClerk has completed SOC 2 Type II audit certification, demonstrating ongoing commitment to data security, availability, and confidentiality.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "End-to-End Encryption",
        description:
          "All data is encrypted in transit and at rest. Meeting recordings, transcripts, and documents are protected with AES-256 encryption.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Audit Trails",
        description:
          "Every action in GovClerk is logged with timestamps and user attribution. Know who accessed, edited, or published any document at any time.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "product/ai-artifacts",
    seo: {
      title: "AI-Powered Artifacts | GovClerk",
      description:
        "Automatically extract action items, summaries, key decisions, and follow-ups from your meetings with AI.",
    },
    hero: {
      label: "Product",
      title: "AI That Extracts What Matters",
      description:
        "GovClerk AI goes beyond transcription. It identifies action items, summarizes discussions, highlights key decisions, and generates follow-up tasks automatically.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Smart Summaries",
        description:
          "Get concise meeting summaries that capture the essential decisions, discussions, and outcomes without reading the full transcript.",
        imageUrl: "/screenshots/minutes-excerpt.png",
      },
      {
        title: "Action Item Detection",
        description:
          "AI automatically identifies commitments, deadlines, and assignments from meeting conversations and turns them into trackable tasks.",
        imageUrl: "/screenshots/minutes-excerpt.png",
      },
      {
        title: "Decision Highlighting",
        description:
          "Key decisions are automatically flagged and linked to the discussion context, making it easy to reference why a decision was made.",
        imageUrl: "/screenshots/minutes-excerpt.png",
      },
    ],
  },
  {
    slug: "solutions/government",
    seo: {
      title: "Government Meeting Management | GovClerk",
      description:
        "Meeting management software built for city councils, county boards, and municipal agencies. Automate agendas, minutes, and public records.",
    },
    hero: {
      label: "Solutions",
      title: "Meeting Management Built for Government",
      description:
        "City councils, county boards, and municipal agencies trust GovClerk to automate agendas, minutes, and public records while meeting open meeting compliance requirements.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Open Meeting Compliance",
        description:
          "Automatically publish agendas and minutes within required timeframes. GovClerk tracks deadlines and ensures your records meet state and local transparency laws.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Council Meeting Workflows",
        description:
          "Purpose-built workflows for council meetings: consent calendars, public hearings, ordinance readings, and roll-call votes are all supported out of the box.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Citizen Access Portal",
        description:
          "Give constituents a searchable, public-facing portal to find agendas, minutes, recordings, and resolutions from any meeting in your history.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "solutions/school-boards",
    seo: {
      title: "School Board Meeting Software | GovClerk",
      description:
        "Meeting management for K-12 school districts, higher education boards, and academic committees. Streamline board governance with AI.",
    },
    hero: {
      label: "Solutions",
      title: "Streamline School Board Governance",
      description:
        "From K-12 districts to higher education, GovClerk helps school boards run efficient meetings, maintain accurate records, and keep families informed.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Board Meeting Packages",
        description:
          "Assemble complete board meeting packages with agendas, supporting documents, and background materials. Distribute digitally to all board members.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Executive Session Support",
        description:
          "Manage closed session agendas, separate minutes, and confidential materials with the access controls school boards require.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Parent and Community Access",
        description:
          "Publish meeting records to a family-friendly portal. Parents and community members can follow board decisions that affect their schools.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "solutions/special-districts",
    seo: {
      title: "Special District Meeting Software | GovClerk",
      description:
        "Meeting management for water, fire, transit, and utility districts. Comply with public meeting requirements and automate record-keeping.",
    },
    hero: {
      label: "Solutions",
      title: "Meeting Management for Special Districts",
      description:
        "Water districts, fire districts, transit authorities, and utility boards have unique meeting requirements. GovClerk handles them all.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Multi-Board Support",
        description:
          "Manage multiple boards and committees within a single district. Each has its own meeting schedule, agendas, and member roster.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Public Hearing Management",
        description:
          "Track public hearing notices, capture public comments, and ensure all required documentation is recorded and published on time.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Small Staff, Big Capability",
        description:
          "Special districts often run lean. GovClerk automates the record-keeping that would otherwise require a dedicated clerk.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "solutions/nonprofits",
    seo: {
      title: "Nonprofit Board Meeting Software | GovClerk",
      description:
        "Board governance and volunteer committee management for nonprofits. Keep your organization transparent and well-documented.",
    },
    hero: {
      label: "Solutions",
      title: "Board Governance for Nonprofits",
      description:
        "Nonprofits deserve the same meeting tools as government agencies. GovClerk helps your board stay organized, transparent, and audit-ready.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Board Meeting Management",
        description:
          "Run board meetings with structured agendas, recorded votes, and published minutes. Keep your board governance up to grant compliance standards.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Committee Coordination",
        description:
          "Finance committees, program committees, and volunteer groups each get their own meeting space with agendas, minutes, and member management.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Audit-Ready Records",
        description:
          "Maintain complete meeting records that satisfy auditors, funders, and regulatory bodies. Every document is timestamped and version-controlled.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "solutions/committees",
    seo: {
      title: "Committee Meeting Software | GovClerk",
      description:
        "Meeting management for standing committees, advisory boards, and working groups. Structure and automate committee workflows.",
    },
    hero: {
      label: "Solutions",
      title: "Run Better Committee Meetings",
      description:
        "Standing committees, advisory boards, and working groups need structure without overhead. GovClerk gives committees the tools to be productive and accountable.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "Committee Workspaces",
        description:
          "Each committee gets its own workspace with meeting history, document library, member roster, and upcoming agenda drafts.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Recommendations and Reports",
        description:
          "Committees produce recommendations for the full board. GovClerk tracks recommendations from draft through board action.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Cross-Committee Visibility",
        description:
          "See what every committee is working on from a single dashboard. Prevent duplicated efforts and keep the full board informed.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "about",
    seo: {
      title: "About GovClerk | AI Meeting Management",
      description:
        "GovClerk is built by the GovClerkMinutes team. Learn about our mission to modernize how organizations run meetings.",
    },
    hero: {
      label: "Company",
      title: "Modernizing How Organizations Run Meetings",
      description:
        "GovClerk is built by the GovClerkMinutes team with a single mission: eliminate the hours of manual work that go into every meeting, so organizations can focus on the decisions that matter.",
    },
    features: [
      {
        title: "Our Mission",
        description:
          "Government bodies, school boards, and nonprofits spend thousands of hours each year on meeting paperwork. We believe that time belongs to the communities they serve.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Built by GovClerkMinutes",
        description:
          "GovClerk is powered by the same AI transcription and minutes generation technology trusted by thousands of organizations through GovClerkMinutes.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "contact",
    seo: {
      title: "Contact GovClerk | Get in Touch",
      description:
        "Have questions about GovClerk? Contact our sales and support teams for demos, pricing, and technical assistance.",
    },
    hero: {
      label: "Company",
      title: "Get in Touch with Our Team",
      description:
        "Whether you need a demo, have a question about pricing, or want technical support, our team is here to help. Reach out and we will get back to you within one business day.",
    },
    features: [
      {
        title: "Sales Inquiries",
        description:
          "Interested in GovClerk for your organization? Our sales team can walk you through features, pricing, and implementation. Email us at sales@govclerkminutes.com.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Technical Support",
        description:
          "Already a customer? Our support team is available to help with setup, integrations, and any technical questions. Email support@govclerkminutes.com.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "careers",
    seo: {
      title: "Careers at GovClerk | Join Our Team",
      description:
        "Join the team building AI-powered meeting management for government and organizations. See open positions at GovClerk.",
    },
    hero: {
      label: "Company",
      title: "Build the Future of Meeting Management",
      description:
        "We are building tools that save thousands of hours for government bodies, school boards, and nonprofits. If that sounds like meaningful work, we want to hear from you.",
    },
    features: [
      {
        title: "Why GovClerk",
        description:
          "We are a small, focused team solving a real problem for real organizations. Every feature you build has a direct impact on how communities are governed.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Open Positions",
        description:
          "We are always looking for talented engineers, designers, and go-to-market professionals. Check back for open roles or send your resume to careers@GovClerk.com.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "partners",
    seo: {
      title: "Partner with GovClerk | Integration Partners",
      description:
        "Become a GovClerk partner. Integration partnerships, reseller programs, and technology alliances for meeting management.",
    },
    hero: {
      label: "Company",
      title: "Partner with GovClerk",
      description:
        "We work with technology partners, consultants, and resellers who serve government and public-sector organizations. Let us build something together.",
    },
    features: [
      {
        title: "Technology Partnerships",
        description:
          "Integrate your platform with GovClerk to offer meeting management as part of your solution. APIs and webhooks make integration straightforward.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Reseller Program",
        description:
          "Serve government clients? Add GovClerk to your portfolio. We provide training, co-marketing, and dedicated partner support.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "overview",
    seo: {
      title: "Platform Overview | GovClerk",
      description:
        "See how GovClerk connects agenda management, transcription, AI minutes, votes, and public records into one seamless meeting workflow.",
    },
    hero: {
      label: "Resources",
      title: "One Platform, Every Step of Your Meeting",
      description:
        "GovClerk brings together agenda building, live transcription, AI-powered minutes, vote tracking, and public records publishing so your team can move from preparation to compliance in a single workflow.",
      imageUrl: "/screenshots/desktop-v2.png",
    },
    features: [
      {
        title: "End-to-End Meeting Lifecycle",
        description:
          "Most teams juggle separate tools for agendas, notes, recordings, and publishing. GovClerk replaces that patchwork with a connected pipeline where each step feeds into the next automatically.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Works with Your Existing Stack",
        description:
          "GovClerk integrates with calendar systems, video conferencing platforms, and document storage providers your organization already uses, so adoption is fast and friction-free.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Built for Teams of Every Size",
        description:
          "Whether you manage a single board or coordinate dozens of committees, GovClerk scales to match your organizational structure without additional complexity.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "blog",
    seo: {
      title: "Blog | GovClerk",
      description:
        "Insights on meeting management, public transparency, AI in government, and best practices for clerks and board administrators.",
    },
    hero: {
      label: "Resources",
      title: "Insights for Modern Meeting Management",
      description:
        "Practical advice, product updates, and industry perspectives for clerks, board administrators, and anyone responsible for keeping meetings organized and transparent.",
    },
    features: [
      {
        title: "Product Updates",
        description:
          "Stay current with the latest GovClerk features, improvements, and integrations. We publish detailed release notes so you always know what is new.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Best Practices",
        description:
          "Learn how leading organizations streamline their meeting workflows, improve public engagement, and reduce the administrative burden on their staff.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Industry Perspectives",
        description:
          "Explore how AI, digital transparency, and evolving regulations are reshaping the way government bodies and nonprofits conduct their meetings.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "docs",
    seo: {
      title: "Documentation | GovClerk",
      description:
        "Technical documentation, API reference, setup guides, and integration instructions for GovClerk meeting management software.",
    },
    hero: {
      label: "Resources",
      title: "Documentation and Developer Guides",
      description:
        "Everything you need to set up, configure, and integrate GovClerk. From getting started guides to API reference, our documentation helps your team move quickly.",
    },
    features: [
      {
        title: "Getting Started",
        description:
          "Step-by-step guides walk you through account setup, organization configuration, and your first meeting. Most teams are up and running within a single afternoon.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "API Reference",
        description:
          "Integrate GovClerk into your existing systems with our REST API. Full endpoint documentation, authentication guides, and code examples are included.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Integration Guides",
        description:
          "Connect GovClerk with calendar providers, video conferencing tools, and document storage systems. Each guide includes prerequisites, setup steps, and troubleshooting tips.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "help",
    seo: {
      title: "Help Center | GovClerk",
      description:
        "Find answers to common questions, troubleshooting guides, and support contact information for GovClerk meeting management software.",
    },
    hero: {
      label: "Resources",
      title: "How Can We Help?",
      description:
        "Browse frequently asked questions, troubleshooting guides, and step-by-step tutorials. If you need more assistance, our support team is one message away.",
    },
    features: [
      {
        title: "Frequently Asked Questions",
        description:
          "Answers to the most common questions about account setup, billing, meeting workflows, and feature configuration, all organized by topic for quick access.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Troubleshooting Guides",
        description:
          "Step-by-step instructions for resolving common issues with recordings, transcription accuracy, portal publishing, and user permissions.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Contact Support",
        description:
          "Need hands-on help? Reach our support team by email at support@GovClerk.com. We respond to all inquiries within one business day.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "case-studies",
    seo: {
      title: "Case Studies | GovClerk",
      description:
        "See how government agencies, school boards, and nonprofits use GovClerk to save time, improve transparency, and modernize their meeting workflows.",
    },
    hero: {
      label: "Resources",
      title: "Real Results from Real Organizations",
      description:
        "Discover how cities, school districts, and nonprofits have transformed their meeting workflows with GovClerk. Each case study details the challenges, implementation process, and measurable outcomes.",
    },
    features: [
      {
        title: "Government Success Stories",
        description:
          "Learn how municipal clerks have reduced minutes preparation time by up to 80% while improving the accuracy and consistency of their public records.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Education Outcomes",
        description:
          "School districts share how GovClerk streamlined board meeting workflows, increased community access to meeting records, and freed staff time for student-focused work.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Nonprofit Impact",
        description:
          "Nonprofit boards describe how structured meeting management improved governance practices, satisfied auditors, and strengthened trust with donors and stakeholders.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
  {
    slug: "acceptable-use",
    seo: {
      title: "Acceptable Use Policy | GovClerk",
      description:
        "GovClerk acceptable use policy. Guidelines for responsible use of our meeting management platform and services.",
    },
    hero: {
      label: "Legal",
      title: "Acceptable Use Policy",
      description:
        "This policy outlines the rules and guidelines for using GovClerk services. By using our platform, you agree to comply with these terms to ensure a safe and productive experience for all users.",
    },
    features: [
      {
        title: "Permitted Use",
        description:
          "GovClerk is designed for legitimate meeting management activities including agenda creation, meeting recording, transcription, minutes generation, and public records publishing.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Prohibited Activities",
        description:
          "Users may not use GovClerk for unauthorized surveillance, distribution of harmful content, circumvention of security controls, or any activity that violates applicable law.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
      {
        title: "Enforcement",
        description:
          "GovClerk reserves the right to suspend or terminate accounts that violate this policy. If you believe a violation has occurred, please report it to compliance@GovClerk.com.",
        imageUrl: "/screenshots/desktop-v2.png",
      },
    ],
  },
];

export function findPageBySlug(slug: string): GovClerkPageData | undefined {
  return GovClerkPages.find((page) => page.slug === slug);
}
