import { Template } from "@/types/Template";

export const teamHuddleTemplate: Template = {
  id: "team-huddle-minutes",
  name: "Team Huddle Minutes",
  description: "A quick and efficient template for daily standups and team sync meetings",
  category: "team-standup",
  useCase:
    "Perfect for agile teams, daily standups, sprint check-ins, and quick team synchronization meetings. Focuses on what was done, what's next, and blockers.",
  advantages: [
    "Keeps meetings brief and focused with structured format for yesterday's progress, today's goals, and blockers",
    "Facilitates transparent team communication and accountability with clear daily objectives and progress visibility",
    "Captures team mood and energy levels to identify support needs and maintain team health",
  ],
  preview: `# Engineering Team Daily Standup

**Team:** Backend Engineering
**Date:** March 21, 2024
**Sprint:** Sprint 24 (Day 8 of 10)
**Facilitator:** Emma Rodriguez

## Team Updates

### Alex Chen (Senior Engineer)
**Yesterday:** Completed API endpoint for user authentication. Deployed to staging and all tests passing.
**Today:** Starting work on password reset flow. Will pair with Jordan on database schema updates.
**Blockers:** None

### Jordan Kim (Engineer)
**Yesterday:** Reviewed Alex's PR and approved. Fixed bug in notification service that was causing delays.
**Today:** Database migration for new user fields. Meeting with DevOps about deployment pipeline.
**Blockers:** Waiting for staging environment access from IT (ticket #4521)

### Sam Patel (Engineer)
**Yesterday:** Implemented caching layer for product catalog. Performance improved by 40%.
**Today:** Code review for Maria's feature branch. Documentation updates for API changes.
**Blockers:** None

### Maria Santos (Junior Engineer)
**Yesterday:** Working on search functionality. Completed unit tests.
**Today:** Finishing search feature and submitting PR for review.
**Blockers:** Need clarification on search ranking algorithm from product team

## Team Coordination
- Alex and Jordan pairing on database work this afternoon
- Code freeze for Sprint 24 tomorrow at 5 PM
- Sprint demo scheduled for March 23 at 2 PM

## Action Items
- Emma: Follow up with IT on Jordan's staging access (Priority: High)
- Maria: Schedule 30-min meeting with product team about search requirements
- Team: Submit all PRs by end of day tomorrow for sprint inclusion

## Team Mood: 😊 Positive - On track for sprint goals`,
  content: `# Team Huddle Meeting Minutes

**Team/Department:** [Team name]  
**Meeting Date:** [Date]  
**Meeting Time:** [Start Time] - [End Time]  
**Meeting Location:** [Conference room/Virtual platform/Workspace area]  
**Meeting Type:** [Daily standup/Weekly huddle/Quick sync/Sprint check-in]  
**Facilitator:** [Name, Role]

## Team Members

**Present:**
- [Name, Role] - [Status: Remote/In-person]
- [Name, Role] - [Status: Remote/In-person]
- [Name, Role] - [Status: Remote/In-person]
- [Name, Role] - [Status: Remote/In-person]

**Absent:**
- [Name, Role] - [Reason: Sick/Vacation/Meeting/Client call]

**Guests/Others:**
- [Name, Role] - [Reason for attendance]

## Meeting Overview
**Sprint/Iteration:** [Current sprint or work cycle]  
**Days remaining in sprint:** [Number of days]  
**Team capacity:** [Available team members and hours]  
**Overall team mood/energy:** [High/Medium/Low - general team sentiment]

## Yesterday's Progress (What We Accomplished)

### [Team Member Name]
**Completed tasks:**
- [Task completed] - [Brief description] - **Time spent:** [Hours]
- [Task completed] - [Brief description] - **Status:** [Done/Needs review]

**Key accomplishments:**
- [Significant achievement or milestone reached]
- [Problem solved or breakthrough made]

### [Team Member Name]
**Completed tasks:**
- [Task completed] - [Brief description] - **Impact:** [Business value delivered]
- [Task completed] - [Brief description] - **Quality:** [Testing status]

**Collaboration highlights:**
- [Helped team member with specific task]
- [Knowledge sharing or mentoring provided]

## Today's Goals (What We're Working On)

### [Team Member Name]
**Primary focus:**
- [Main task/priority for today] - **Expected completion:** [EOD/Specific time] - **Dependencies:** [What's needed]
- [Secondary task] - **Priority level:** [High/Medium/Low]

**Collaboration needs:**
- [Help needed from specific team member] - **For:** [Specific assistance required]
- [Review or feedback needed] - **From:** [Who] - **By when:** [Time needed]

### [Team Member Name]
**Primary focus:**
- [Main task/priority for today] - **Deliverable:** [What will be produced]
- [Secondary task] - **Estimated effort:** [Hours/Complexity]

**Meetings/appointments:**
- [Client call/meeting] - **Time:** [When] - **Purpose:** [Objective]
- [Team collaboration session] - **Participants:** [Who involved]

## Blockers and Issues

### Current Blockers
**Blocker:** [Description of obstacle]  
**Affected team member(s):** [Who is blocked]  
**Impact:** [How this affects work/timeline]  
**Resolution needed:** [What must happen to remove blocker]  
**Owner:** [Who will resolve] - **Target resolution:** [When]

**Blocker:** [Description of obstacle]  
**Type:** [Technical/Resource/External dependency]  
**Escalation needed:** [Yes/No] - **To whom:** [Manager/Client/Other team]  
**Workaround available:** [Alternative approach if possible]

### Risks and Concerns
- [Potential issue that might become a blocker] - **Probability:** [High/Medium/Low] - **Mitigation:** [Prevention plan]
- [Resource constraint approaching] - **Timeline:** [When this becomes critical] - **Action needed:** [How to address]

## Team Coordination

### Cross-team Dependencies
**Dependency:** [What we need from another team]  
**Team:** [Which team we depend on] - **Contact:** [Who to coordinate with]  
**Timeline:** [When we need this] - **Status:** [Progress of dependency]

**Dependency:** [What another team needs from us]  
**Responsible:** [Team member providing support] - **Delivery date:** [When we'll provide]

### Resource Sharing
- [Equipment/tool sharing] - **Between:** [Team members] - **Schedule:** [When available]
- [Knowledge transfer needed] - **From:** [Who has knowledge] - **To:** [Who needs to learn]

## Quick Wins and Celebrations

**Achievements to celebrate:**
- [Team accomplishment worth recognizing]
- [Individual achievement that benefits team]
- [Client praise or positive feedback received]

**Process improvements:**
- [Efficiency gain implemented]
- [Tool or technique that's working well]
- [Communication improvement noticed]

## Daily Metrics (if applicable)

**Productivity indicators:**
- **Stories/tasks completed:** [Number] - **Target:** [Goal]
- **Code commits:** [Number] - **Quality:** [Review status]
- **Client deliverables:** [Number delivered] - **Client satisfaction:** [Feedback]

**Quality metrics:**
- **Bugs found/fixed:** [Numbers] - **Trend:** [Improving/Stable/Concerning]
- **Code review completion:** [Percentage] - **Average time:** [Hours]

## Announcements and Updates

### Company/Department News
- [Important company update affecting team]
- [Policy change or new procedure]
- [Upcoming company event or deadline]

### Team-specific Updates
- [New team member starting] - **Start date:** [When] - **Onboarding plan:** [Who handles]
- [Team member departure/vacation] - **Dates:** [When] - **Coverage plan:** [Who covers work]
- [New project assignment] - **Project:** [Name] - **Team impact:** [How it affects current work]

### Technology/Tools Updates
- [System maintenance scheduled] - **Date/time:** [When] - **Impact:** [What's affected]
- [New tool rollout] - **Training needed:** [Yes/No] - **Timeline:** [Implementation schedule]

## Action Items (Keep it Simple)

| Action | Owner | Due | Priority |
|---------|-------|-----|----------|
| [Quick task] | [Name] | [Today/Tomorrow] | [High/Low] |
| [Quick task] | [Name] | [Today/Tomorrow] | [High/Low] |
| [Follow-up needed] | [Name] | [This week] | [Medium] |

## Follow-Up Notes

**Parking Lot Items:**
- [Topic parked for future discussion] - **Owner:** [Name]

## Parking Lot (Items for Later Discussion)
- [Topic that came up but needs longer discussion] - **Schedule:** [When to address]
- [Idea that needs exploration] - **Owner:** [Who will investigate]
- [Process improvement suggestion] - **Next step:** [How to evaluate]

## Team Mood Check

### Energy Level
- **High energy topics:** [What's energizing the team]
- **Low energy areas:** [What's draining or frustrating]
- **Support needed:** [How to help team members]

### Collaboration Health
- **Working well:** [Collaboration that's effective]
- **Needs improvement:** [Communication or coordination gaps]
- **Team building opportunity:** [Social or development activity needed]

## Daily Recognition
- [Shout-out to team member for specific contribution]
- [Positive client feedback or stakeholder comment]

## Tomorrow's Preview

**Key priorities for tomorrow:**
- [Important task/milestone approaching]
- [Client deliverable due]
- [Team event or meeting scheduled]

**Preparation needed:**
- [What needs to be ready for tomorrow's work]
- [Dependencies that must be resolved today]

**Capacity planning:**
- [Team member availability changes]
- [Resource allocation adjustments needed]

## Meeting Wrap-up

**Meeting duration:** [Actual time taken] - **Target:** [Planned duration]  
**Key takeaways:**
1. [Main outcome or decision from huddle]
2. [Important coordination point established]
3. [Critical blocker identified and assigned]

**Next huddle focus:**
- [Special topic or area of emphasis for next meeting]
- [Follow-up items to check on]

## Next Meeting
**Date:** [Next huddle date]  
**Time:** [Same time/Different time]  
**Location:** [Same location/Different location]  
**Special agenda:** [Any special topics for next meeting]

---

**Minutes captured by:** [Name]  
**Meeting ended at:** [Time]

**Quick distribution:**
- Team members
- [Team lead/manager if not present]
- [Stakeholder who needs daily updates]

---

**Team motto/energizer:** [Optional team motivational message or inside joke]  
**Today's focus word:** [Single word that captures the day's priority]`,
  isCustom: false,
};
