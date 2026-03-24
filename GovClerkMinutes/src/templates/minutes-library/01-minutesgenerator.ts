import { Template } from "@/types/Template";

export const GovClerkMinutesTemplate: Template = {
  id: "GovClerkMinutes-template",
  name: "GovClerkMinutes Template",
  description:
    "The official GovClerkMinutes template structure optimized for AI-generated meeting minutes",
  category: "meeting-minutes",
  useCase:
    "Perfect for AI-generated meeting minutes from transcripts. Uses speaker labels ({{A}}, {{B}}) and narrative paragraph style for professional documentation.",
  advantages: [
    "Optimized for AI transcription with speaker label system ({{A}}, {{B}}, etc.) for anonymous documentation",
    "Follows formal meeting minute conventions with proper structure for motions, decisions, and action items",
    "Uses narrative paragraph style for natural flow and professional presentation of discussions",
  ],
  preview: `# Q1 2024 Product Strategy Meeting

**Date:** March 15, 2024
**Time:** 2:00 PM - 3:30 PM
**Location:** Conference Room B

## Attendees
- {{A}} (Product Manager)
- {{B}} (Engineering Lead)
- {{C}} (Design Director)

## Key Discussion Points

{{A}} opened the meeting by reviewing Q1 product performance. Analytics showed 23% user growth, with mobile engagement up 45% compared to last quarter.

{{B}} raised concerns about technical debt in the authentication system and recommended prioritizing this before adding new features. The team discussed the trade-offs and agreed on the importance of addressing technical debt.

{{C}} presented updated designs for the dashboard redesign. The team provided feedback on information hierarchy and suggested simplifying the navigation structure.

## Decisions Made
- Prioritize authentication system refactor in Q2
- Approve dashboard redesign with requested modifications
- Allocate 30% of engineering resources to technical debt

## Action Items
- {{A}}: Schedule user testing sessions for dashboard (Due: March 22)
- {{B}}: Prepare technical specification for auth refactor (Due: March 20)
- {{C}}: Revise dashboard mockups based on feedback (Due: March 18)`,
  content: `**[Organization Name]**
**[Committee/Department Name]**
**[Location]**
**[Date]**
**[Time]**

**Attendance**

**Committee Members:**
* {{A}} (Chair)
* {{B}} (Member)
* {{C}} (Member)

**Staff:**
* {{D}} (Staff Title)

**Guests:**
* {{E}} (Organization/Affiliation)

**Call to Order**

The meeting was called to order at [Time] by {{A}}, Chair.

**Approval of Minutes**

The minutes from the [Previous Meeting Date] meeting were reviewed.

**Motion:** Made by {{B}}, seconded by {{C}}, to approve the minutes as presented.
The motion passed unanimously.

**[Agenda Item 1 Title]**

[Narrative summary of discussion. {{A}} presented the main points regarding the topic. {{B}} raised concerns about specific aspects. The committee discussed various approaches and considered the implications.]

**Key Points:**
* [Point 1 from discussion]
* [Point 2 from discussion]
* [Point 3 from discussion]

**Motion:** Made by {{B}}, seconded by {{C}}, to [action/decision].
The motion passed [vote details if applicable].

**[Agenda Item 2 Title]**

[Narrative summary of discussion and key points raised by participants.]

**Action Items**

* **{{B}}:** [Action item description] - Due: [Date]
* **{{D}}:** [Action item description] - Due: [Date]

**Announcements**

* [Announcement 1]
* [Announcement 2]

**Adjournment**

The meeting was adjourned at [Time].

**The next meeting date was not specified.**`,
  isCustom: false,
};
