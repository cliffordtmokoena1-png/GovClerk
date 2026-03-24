import {
  LuFileText,
  LuMic,
  LuClock,
  LuUsers,
  LuDownload,
  LuCopy,
  LuSmartphone,
  LuSparkles,
  LuCheckSquare,
  LuLanguages,
  LuPencil,
  LuUpload,
  LuLibrary,
  LuFileCheck,
  LuFilePlus2,
  LuMic2,
  LuSave,
  LuPlay,
  LuHeadphones,
  LuDollarSign,
  LuUserPlus,
  LuShield,
} from "react-icons/lu";
import { IconType } from "react-icons";

export interface FeatureBenefit {
  title: string;
  description: string;
  iconName?: string;
}

export interface FeatureData {
  slug: string;
  title: string;
  description: string;
  iconName: string;
  layout: "2+3" | "2+4" | "2+5" | "2+0";
  topCards: FeatureBenefit[];
  bottomCards: FeatureBenefit[];
}

// Icon map for resolving icon names to IconType at runtime
export const featureIconMap: Record<string, IconType> = {
  LuFileText,
  LuMic,
  LuClock,
  LuUsers,
  LuDownload,
  LuCopy,
  LuSmartphone,
  LuSparkles,
  LuCheckSquare,
  LuLanguages,
  LuPencil,
  LuUpload,
  LuLibrary,
  LuFileCheck,
  LuFilePlus2,
  LuMic2,
  LuSave,
  LuPlay,
  LuHeadphones,
  LuDollarSign,
  LuUserPlus,
  LuShield,
};

export function getFeatureIcon(iconName: string): IconType {
  return featureIconMap[iconName] || LuFileText;
}

export const featuresData: Record<string, FeatureData> = {
  "meeting-minutes-generation": {
    slug: "meeting-minutes-generation",
    title: "AI-Powered Meeting Minutes Generation",
    description:
      "Transform your meetings into professional, structured minutes instantly. Our AI analyzes your conversations and generates comprehensive meeting documentation with key decisions, action items, and participant contributions automatically organized.",
    iconName: "LuFileText",
    layout: "2+3",
    topCards: [
      {
        title: "Structured Discussions",
        description:
          "Automatically structure discussions into clear sections with intelligent topic detection and organization.",
        iconName: "LuFileText",
      },
      {
        title: "Key Decisions Highlighted",
        description:
          "Identify and highlight key decisions made during the meeting for easy reference and follow-up.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [
      {
        title: "Action Items Extraction",
        description:
          "Extract action items with assigned owners and deadlines automatically from meeting conversations.",
        iconName: "LuUsers",
      },
      {
        title: "Professional Formatting",
        description:
          "Professional formatting ready for distribution to stakeholders and team members.",
        iconName: "LuSparkles",
      },
      {
        title: "Save Time",
        description:
          "Save hours of manual note-taking and focus on participating in the meeting instead.",
        iconName: "LuClock",
      },
    ],
  },
  "transcript-generation": {
    slug: "transcript-generation",
    title: "Accurate Speech-to-Text Transcription",
    description:
      "Get word-for-word transcripts of your meetings with industry-leading accuracy. Our advanced speech recognition technology captures every spoken word, making it easy to search, reference, and quote exact conversations.",
    iconName: "LuMic",
    layout: "2+3",
    topCards: [
      {
        title: "99%+ Accuracy",
        description:
          "Industry-leading transcription accuracy across accents, dialects, and speaking styles.",
        iconName: "LuMic",
      },
      {
        title: "Real-time Transcription",
        description: "Get live transcription during meetings as conversations happen in real-time.",
        iconName: "LuSparkles",
      },
    ],
    bottomCards: [
      {
        title: "Speaker Labels",
        description:
          "Automatic speaker labels for multi-participant conversations with intelligent voice recognition.",
        iconName: "LuUsers",
      },
      {
        title: "Searchable Text",
        description:
          "Search through transcripts to find specific topics, quotes, or decisions instantly.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Multi-language",
        description: "Support for 96+ languages ensuring global team collaboration.",
        iconName: "LuLanguages",
      },
    ],
  },
  "meeting-hours": {
    slug: "meeting-hours",
    title: "Flexible Meeting Hour Allocations",
    description:
      "Choose the plan that fits your meeting volume. From 5 hours for occasional meetings to unlimited hours for enterprise teams, scale your transcription capacity as your needs grow.",
    iconName: "LuClock",
    layout: "2+3",
    topCards: [
      {
        title: "Scalable Plans",
        description:
          "Basic with 5 hours/month, Pro with 20 hours/month, or Custom with unlimited hours for enterprise.",
        iconName: "LuClock",
      },
      {
        title: "Rollover Hours",
        description: "Unused hours roll over to next month so you never lose your allocation.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [
      {
        title: "Individual Users",
        description: "Basic plan perfect for individual users with occasional meeting needs.",
        iconName: "LuUsers",
      },
      {
        title: "Regular Teams",
        description:
          "Pro plan ideal for teams with regular meeting schedules and collaboration needs.",
        iconName: "LuFileText",
      },
      {
        title: "Easy Upgrades",
        description: "Seamlessly upgrade as your team grows with no interruption to service.",
        iconName: "LuSparkles",
      },
    ],
  },
  "speaker-recognition": {
    slug: "speaker-recognition",
    title: "Intelligent Speaker Recognition",
    description:
      "Automatically identify who said what in your meetings. Our speaker recognition technology learns voices over time, providing accurate speaker labels even in complex multi-party conversations.",
    iconName: "LuUsers",
    layout: "2+3",
    topCards: [
      {
        title: "Smart Voice Detection",
        description:
          "Distinguish between different speakers in meetings with AI-powered voice recognition.",
        iconName: "LuUsers",
      },
      {
        title: "Cross-meeting Memory",
        description:
          "Pro and Custom plans remember speakers across meetings for consistent labeling.",
        iconName: "LuMic",
      },
    ],
    bottomCards: [
      {
        title: "Auto Labeling",
        description:
          "Automatic speaker labeling throughout the entire transcript without manual intervention.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Manual Override",
        description: "Easily correct speaker labels and assign names when needed for accuracy.",
        iconName: "LuPencil",
      },
      {
        title: "Learning System",
        description: "Recognition accuracy improves with each meeting as the system learns voices.",
        iconName: "LuSparkles",
      },
    ],
  },
  "export-formats": {
    slug: "export-formats",
    title: "Export to Word & PDF",
    description:
      "Take your meeting minutes anywhere. Export to professional Word documents or PDF files with proper formatting, ready to share with stakeholders, file in records, or edit further.",
    iconName: "LuDownload",
    layout: "2+3",
    topCards: [
      {
        title: "Word Export",
        description:
          "Microsoft Word (.docx) format with full formatting preservation for easy editing and distribution.",
        iconName: "LuDownload",
      },
      {
        title: "PDF Export",
        description:
          "PDF export for universal compatibility across all devices and platforms without formatting issues.",
        iconName: "LuFileText",
      },
    ],
    bottomCards: [
      {
        title: "Format Preservation",
        description:
          "Preserve all formatting, headers, and structure exactly as designed in your minutes.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Pro Templates",
        description:
          "Professional templates automatically applied ensuring consistent corporate documentation.",
        iconName: "LuLibrary",
      },
      {
        title: "One-click Export",
        description:
          "Export from any meeting with a single click - no complex setup or configuration needed.",
        iconName: "LuSparkles",
      },
    ],
  },
  "copy-to-clipboard": {
    slug: "copy-to-clipboard",
    title: "Quick Copy to Clipboard",
    description:
      "Need to paste minutes into an email, Slack message, or document? Copy your entire meeting minutes or transcript to clipboard with one click, maintaining all formatting.",
    iconName: "LuCopy",
    layout: "2+3",
    topCards: [
      {
        title: "One-click Copy",
        description:
          "Copy entire minutes or transcript to clipboard instantly with a single click.",
        iconName: "LuCopy",
      },
      {
        title: "Format Preservation",
        description:
          "Preserves markdown formatting for compatible platforms like Slack and Notion.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [
      {
        title: "Share Anywhere",
        description: "Perfect for sharing in Slack, Teams, email, or any messaging platform.",
        iconName: "LuFileText",
      },
      {
        title: "Section Copy",
        description: "Copy specific sections as needed rather than the entire document.",
        iconName: "LuSparkles",
      },
      {
        title: "Instant Ready",
        description: "Available immediately after generation with no wait time or processing.",
        iconName: "LuClock",
      },
    ],
  },
  "mobile-app": {
    slug: "mobile-app",
    title: "Mobile Web App (PWA)",
    description:
      "Access GovClerkMinutes on any device. Our Progressive Web App works seamlessly on mobile phones and tablets, letting you record meetings, review minutes, and manage transcripts on the go.",
    iconName: "LuSmartphone",
    layout: "2+3",
    topCards: [
      {
        title: "Cross-platform",
        description:
          "Full functionality on iOS and Android devices with native-like performance and features.",
        iconName: "LuSmartphone",
      },
      {
        title: "Home Screen Install",
        description: "Install on your home screen just like a native app for quick access anytime.",
        iconName: "LuDownload",
      },
    ],
    bottomCards: [
      {
        title: "Offline Access",
        description:
          "Works offline for viewing saved minutes when you don't have internet connectivity.",
        iconName: "LuClock",
      },
      {
        title: "Mobile Optimized",
        description:
          "Responsive design specifically optimized for mobile screens and touch interactions.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Sync Everywhere",
        description:
          "Same account and data seamlessly synced across all your devices automatically.",
        iconName: "LuUsers",
      },
    ],
  },
  "ai-summary": {
    slug: "ai-summary",
    title: "AI Summary & Key Points",
    description:
      "Get the essence of your meeting in seconds. Our AI identifies the most important topics, decisions, and takeaways, generating a concise summary perfect for executives and team members who couldn't attend.",
    iconName: "LuSparkles",
    layout: "2+4",
    topCards: [
      {
        title: "Key Topics",
        description:
          "Bullet-point summary of key discussion topics automatically extracted from conversations.",
        iconName: "LuSparkles",
      },
      {
        title: "Decision Tracking",
        description:
          "Automatic identification of important decisions made during the meeting for accountability.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [
      {
        title: "Critical Highlights",
        description:
          "Highlight critical information for quick review without reading full transcripts.",
        iconName: "LuFileText",
      },
      {
        title: "Share with Absent",
        description: "Perfect for sharing with team members who couldn't attend the meeting.",
        iconName: "LuUsers",
      },
      {
        title: "Save Time",
        description:
          "Save time by reading concise summaries instead of full hour-long transcripts.",
        iconName: "LuClock",
      },
      {
        title: "Executive Ready",
        description: "Executive-ready summaries for leadership teams and stakeholders.",
        iconName: "LuDownload",
      },
    ],
  },
  "action-items": {
    slug: "action-items",
    title: "Automatic Action Items Extraction",
    description:
      "Never miss a follow-up task. Our AI automatically identifies action items, commitments, and assignments mentioned during your meeting, organizing them in a clear, actionable format.",
    iconName: "LuCheckSquare",
    layout: "2+3",
    topCards: [
      {
        title: "Auto Detection",
        description:
          "Automatically detect tasks and commitments from natural meeting conversations without manual tagging.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Owner Assignment",
        description:
          "Identify who is responsible for each action item based on meeting discussion context.",
        iconName: "LuUsers",
      },
    ],
    bottomCards: [
      {
        title: "Deadline Extraction",
        description:
          "Extract deadlines and due dates mentioned in conversations for automatic task tracking.",
        iconName: "LuClock",
      },
      {
        title: "Task Management Ready",
        description:
          "Organized lists ready for export to Asana, Jira, or your preferred task management tools.",
        iconName: "LuLibrary",
      },
      {
        title: "Accountability",
        description: "Ensure accountability and follow-through with clear assignment and tracking.",
        iconName: "LuSparkles",
      },
    ],
  },
  "multi-language": {
    slug: "multi-language",
    title: "96+ Languages Supported",
    description:
      "Work in your language. GovClerkMinutes supports transcription and minutes generation in over 96 languages, making it perfect for international teams and multilingual meetings.",
    iconName: "LuLanguages",
    layout: "2+3",
    topCards: [
      {
        title: "Support for 96+ Languages",
        description:
          "From English to Japanese, Spanish to Arabic - we support over 96 languages and dialects with consistent quality across all.",
        iconName: "LuLanguages",
      },
      {
        title: "Automatic Language Detection",
        description:
          "No need to specify - our AI automatically identifies the spoken language and selects the optimal transcription model.",
        iconName: "LuSparkles",
      },
    ],
    bottomCards: [
      {
        title: "Native Language Accuracy",
        description:
          "Get highly accurate transcription in your native language, capturing nuances, idioms, and context specific to your language.",
        iconName: "LuCheckSquare",
      },
      {
        title: "International Teams",
        description:
          "Perfect for global companies and remote teams working across borders with multilingual meeting support.",
        iconName: "LuUsers",
      },
      {
        title: "Consistent Quality",
        description:
          "The same high-quality transcription and minutes generation you expect, regardless of which language you choose.",
        iconName: "LuShield",
      },
    ],
  },
  "edit-format": {
    slug: "edit-format",
    title: "Edit & Format Your Minutes",
    description:
      "Fine-tune your meeting minutes with our intuitive editor. Add context, correct errors, reorganize sections, and apply formatting to create the perfect meeting documentation.",
    iconName: "LuPencil",
    layout: "2+3",
    topCards: [
      {
        title: "Rich Text Editor",
        description:
          "Full-featured rich text editor with formatting tools for professional documentation.",
        iconName: "LuPencil",
      },
      {
        title: "Drag & Drop",
        description:
          "Drag-and-drop section reordering for easy content reorganization without copy-paste.",
        iconName: "LuFileText",
      },
    ],
    bottomCards: [
      {
        title: "Easy Editing",
        description:
          "Add, edit, or remove content easily with intuitive controls and keyboard shortcuts.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Live Preview",
        description: "Real-time preview of changes as you edit for immediate visual feedback.",
        iconName: "LuSparkles",
      },
      {
        title: "Team Collaboration",
        description: "Collaborate with team members on edits for collective document refinement.",
        iconName: "LuUsers",
      },
    ],
  },
  "upload-media": {
    slug: "upload-media",
    title: "Upload Audio, Video & Images",
    description:
      "Process any meeting format. Upload pre-recorded audio, video files, or even images of handwritten notes. Our system extracts all content and generates comprehensive minutes from any source.",
    iconName: "LuUpload",
    layout: "2+4",
    topCards: [
      {
        title: "Multi-format Support",
        description: "Support for MP3, WAV, MP4, MOV, and dozens more audio and video formats.",
        iconName: "LuUpload",
      },
      {
        title: "Meeting Recordings",
        description:
          "Process recorded Zoom, Teams, or Google Meet files directly without conversion.",
        iconName: "LuMic",
      },
    ],
    bottomCards: [
      {
        title: "OCR Technology",
        description: "OCR for images and scanned documents to extract text from handwritten notes.",
        iconName: "LuFileText",
      },
      {
        title: "Drag & Drop",
        description: "Simple drag-and-drop file upload interface for quick and easy processing.",
        iconName: "LuCopy",
      },
      {
        title: "Batch Processing",
        description: "Upload and process multiple files simultaneously for efficient workflow.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Cloud Storage",
        description: "All uploads securely stored and accessible from anywhere on any device.",
        iconName: "LuLibrary",
      },
    ],
  },
  "template-library": {
    slug: "template-library",
    title: "Comprehensive Template Library",
    description:
      "Start with proven meeting minute formats. Access our library of professional templates for board meetings, team huddles, client calls, and more. Each template is designed by meeting management experts.",
    iconName: "LuLibrary",
    layout: "2+3",
    topCards: [
      {
        title: "12+ Templates",
        description:
          "Access 12+ professionally designed templates created by meeting management experts.",
        iconName: "LuLibrary",
      },
      {
        title: "Meeting Types",
        description:
          "Templates for board meetings, team meetings, client calls, and more meeting types.",
        iconName: "LuFileText",
      },
    ],
    bottomCards: [
      {
        title: "Industry Specific",
        description:
          "Industry-specific formats for healthcare, legal, nonprofit, and other sectors.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Best Practices",
        description:
          "Best-practice meeting structures built in for effective documentation standards.",
        iconName: "LuUsers",
      },
      {
        title: "Regular Updates",
        description:
          "Regularly updated with new templates based on user feedback and industry trends.",
        iconName: "LuSparkles",
      },
    ],
  },
  "create-from-template": {
    slug: "create-from-template",
    title: "Create Minutes from Template",
    description:
      "Generate perfectly structured minutes every time. Select a template before processing your meeting, and our AI automatically organizes the content according to your chosen format.",
    iconName: "LuFileCheck",
    layout: "2+3",
    topCards: [
      {
        title: "Consistent Format",
        description:
          "Maintain consistent formatting across all meetings with automated template application.",
        iconName: "LuFileCheck",
      },
      {
        title: "AI Adaptation",
        description:
          "AI intelligently adapts meeting content to match your selected template structure.",
        iconName: "LuSparkles",
      },
    ],
    bottomCards: [
      {
        title: "Save Time",
        description:
          "Save time with pre-defined sections that automatically populate with relevant content.",
        iconName: "LuClock",
      },
      {
        title: "Recurring Meetings",
        description: "Perfect for recurring meeting types like daily standups or weekly reviews.",
        iconName: "LuLibrary",
      },
      {
        title: "Standards Compliance",
        description:
          "Maintain organizational documentation standards automatically across all teams.",
        iconName: "LuShield",
      },
    ],
  },
  "create-template": {
    slug: "create-template",
    title: "Create Custom Templates from Examples",
    description:
      "Design your own meeting minute templates. Use existing minutes as examples, and our AI learns your preferred structure, formatting, and section organization to create reusable templates.",
    iconName: "LuFilePlus2",
    layout: "2+4",
    topCards: [
      {
        title: "Learn from Best",
        description:
          "Use your best meeting minutes as examples for AI to learn your preferred style.",
        iconName: "LuFilePlus2",
      },
      {
        title: "Pattern Recognition",
        description:
          "AI automatically extracts structure and formatting patterns from your documents.",
        iconName: "LuSparkles",
      },
    ],
    bottomCards: [
      {
        title: "Custom Templates",
        description:
          "Create organization-specific templates that match your unique workflow and requirements.",
        iconName: "LuLibrary",
      },
      {
        title: "Team Sharing",
        description:
          "Share templates across your entire team for consistent documentation practices.",
        iconName: "LuUsers",
      },
      {
        title: "Pro Feature",
        description: "Available in Pro and Custom plans for advanced customization capabilities.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Version Control",
        description: "Track template versions and updates to maintain documentation evolution.",
        iconName: "LuFileText",
      },
    ],
  },
  "builtin-recorder": {
    slug: "builtin-recorder",
    title: "Built-in Meeting Recorder",
    description:
      "Record meetings directly in your browser. No additional software needed. Our built-in recorder captures high-quality audio and immediately processes it into minutes and transcripts.",
    iconName: "LuMic2",
    layout: "2+3",
    topCards: [
      {
        title: "One-click Recording",
        description: "Start recording from any browser with a single click - no setup required.",
        iconName: "LuMic2",
      },
      {
        title: "No Installation",
        description:
          "No software installation or downloads needed - works directly in your browser.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [
      {
        title: "High Quality Audio",
        description:
          "Capture high-quality audio with advanced noise cancellation and clarity optimization.",
        iconName: "LuMic",
      },
      {
        title: "Auto Processing",
        description:
          "Automatic transcription and minutes generation starts immediately after recording ends.",
        iconName: "LuSparkles",
      },
      {
        title: "Cross-device",
        description:
          "Works seamlessly on desktop computers and mobile devices without platform restrictions.",
        iconName: "LuSmartphone",
      },
    ],
  },
  "save-recordings": {
    slug: "save-recordings",
    title: "Save & Archive Recordings",
    description:
      "Keep your audio recordings for future reference. All recordings are securely stored with your minutes, allowing you to review the actual meeting audio whenever needed.",
    iconName: "LuSave",
    layout: "2+3",
    topCards: [
      {
        title: "Secure Storage",
        description:
          "Secure cloud storage for all recordings with enterprise-grade encryption and backup.",
        iconName: "LuSave",
      },
      {
        title: "Linked Documents",
        description:
          "Recordings automatically linked to corresponding minutes and transcripts for easy reference.",
        iconName: "LuShield",
      },
    ],
    bottomCards: [
      {
        title: "Anytime Download",
        description:
          "Download your recordings anytime for offline access or external storage needs.",
        iconName: "LuDownload",
      },
      {
        title: "Compliance Ready",
        description: "Long-term archival capabilities meet regulatory and compliance requirements.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Timestamp Search",
        description:
          "Search through audio using transcript timestamps to find exact moments quickly.",
        iconName: "LuFileText",
      },
    ],
  },
  "recording-to-minutes": {
    slug: "recording-to-minutes",
    title: "Generate Minutes from Recordings",
    description:
      "Turn any audio recording into professional meeting minutes. Upload existing recordings or use our built-in recorder, and watch as AI transforms spoken conversations into structured documentation.",
    iconName: "LuPlay",
    layout: "2+3",
    topCards: [
      {
        title: "Any Length",
        description:
          "Process recordings of any length from 5-minute standups to 4-hour board meetings.",
        iconName: "LuPlay",
      },
      {
        title: "Structure Extraction",
        description:
          "Extract clear structure from unstructured conversations automatically using AI analysis.",
        iconName: "LuSparkles",
      },
    ],
    bottomCards: [
      {
        title: "Speaker ID",
        description:
          "Automatic speaker identification and labeling throughout the entire recording.",
        iconName: "LuUsers",
      },
      {
        title: "Fast Generation",
        description:
          "Generate professional minutes in minutes, not the hours it would take manually.",
        iconName: "LuClock",
      },
      {
        title: "Meeting Platform Support",
        description:
          "Perfect for recorded Zoom, Teams, or Google Meet meetings with direct integration.",
        iconName: "LuFileText",
      },
    ],
  },
  support: {
    slug: "support",
    title: "Dedicated Support",
    description:
      "Get help when you need it. From email support for Basic users to priority chat support for Custom enterprise clients, our team is here to ensure your meeting documentation runs smoothly.",
    iconName: "LuHeadphones",
    layout: "2+3",
    topCards: [
      {
        title: "Tiered Support",
        description:
          "Basic email support with 24-hour response, Pro priority email, and Custom priority plus live chat.",
        iconName: "LuHeadphones",
      },
      {
        title: "Help Documentation",
        description: "Comprehensive help documentation covering all features and common questions.",
        iconName: "LuFileText",
      },
    ],
    bottomCards: [
      {
        title: "Fast Response",
        description:
          "Quick response times ensuring your questions are answered when you need help.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Video Tutorials",
        description: "Extensive video tutorials and best practices guides for effective usage.",
        iconName: "LuShield",
      },
      {
        title: "Expert Team",
        description:
          "Knowledgeable support team with expertise in meeting documentation workflows.",
        iconName: "LuUsers",
      },
    ],
  },
  "custom-volume": {
    slug: "custom-volume",
    title: "Custom Volume Pricing",
    description:
      "Enterprise-scale meeting documentation. Custom plans offer unlimited meeting hours with flexible pricing based on your organization's needs, perfect for large teams and high-volume users.",
    iconName: "LuDollarSign",
    layout: "2+3",
    topCards: [
      {
        title: "Unlimited Hours",
        description: "Unlimited meeting transcription hours with no monthly caps or restrictions.",
        iconName: "LuDollarSign",
      },
      {
        title: "Volume Pricing",
        description:
          "Cost-efficient volume-based pricing tailored to your organization's usage patterns.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [
      {
        title: "Flexible Billing",
        description:
          "Flexible billing arrangements including annual contracts and custom payment terms.",
        iconName: "LuClock",
      },
      {
        title: "Account Manager",
        description:
          "Dedicated account management ensuring smooth operations and strategic guidance.",
        iconName: "LuUsers",
      },
      {
        title: "Custom Integrations",
        description:
          "Custom integrations with your existing tools and enterprise systems available.",
        iconName: "LuLibrary",
      },
    ],
  },
  "account-manager": {
    slug: "account-manager",
    title: "Dedicated Account Manager",
    description:
      "White-glove service for enterprise clients. Your dedicated account manager ensures smooth onboarding, provides strategic guidance, and serves as your direct point of contact for any needs.",
    iconName: "LuUserPlus",
    layout: "2+3",
    topCards: [
      {
        title: "Personal Contact",
        description:
          "Your personal point of contact at GovClerkMinutes for all questions and needs.",
        iconName: "LuUserPlus",
      },
      {
        title: "Strategic Consulting",
        description:
          "Strategic consulting on meeting documentation workflows and process optimization.",
        iconName: "LuHeadphones",
      },
    ],
    bottomCards: [
      {
        title: "Team Training",
        description:
          "Customized training sessions tailored to your team's specific needs and use cases.",
        iconName: "LuShield",
      },
      {
        title: "Priority Features",
        description: "Priority consideration for feature requests important to your organization.",
        iconName: "LuCheckSquare",
      },
      {
        title: "Business Reviews",
        description:
          "Quarterly business reviews to ensure you're getting maximum value from the platform.",
        iconName: "LuSparkles",
      },
    ],
  },
  "money-back-guarantee": {
    slug: "money-back-guarantee",
    title: "14-Day Money Back Guarantee",
    description:
      "Try GovClerkMinutes risk-free. If you're not completely satisfied within the first 14 days, we'll refund your purchase—no questions asked. We're confident you'll love how much time you save.",
    iconName: "LuShield",
    layout: "2+0",
    topCards: [
      {
        title: "Full Refund",
        description:
          "Complete refund within 14 days of purchase with no hidden fees or conditions.",
        iconName: "LuShield",
      },
      {
        title: "No Questions Asked",
        description:
          "Simple no-questions-asked policy - if you're not satisfied, we'll refund immediately.",
        iconName: "LuCheckSquare",
      },
    ],
    bottomCards: [],
  },
};

export const getFeatureBySlug = (slug: string): FeatureData | null => {
  return featuresData[slug] || null;
};
