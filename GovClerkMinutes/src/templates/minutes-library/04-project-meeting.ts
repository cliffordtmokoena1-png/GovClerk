import { Template } from "@/types/Template";

export const projectMeetingTemplate: Template = {
  id: "project-meeting-minutes",
  name: "Project Meeting Minutes",
  description:
    "A detailed template for project status meetings with milestone tracking and resource management",
  category: "project-review",
  useCase:
    "Perfect for project managers tracking deliverables, milestones, risks, and team coordination. Includes sections for work packages, dependencies, and budget updates.",
  advantages: [
    "Tracks project health metrics and milestone progress for proactive risk management and timeline adherence",
    "Documents resource allocation, dependencies, and blockers for effective team coordination and planning",
    "Maintains detailed record of resource allocation and budget discussions for accurate project cost management",
  ],
  preview: `# Phoenix CRM Implementation - Project Status Meeting

**Project:** Phoenix CRM Implementation (Project #2024-CRM-001)
**Meeting Date:** March 19, 2024
**Project Phase:** Development & Testing
**Project Health:** 🟡 Yellow (Minor delays in integration testing)

## Milestone Review
**Completed Milestones:**
- Requirements gathering and documentation (100%)
- Database schema design and approval (100%)
- User interface mockups approved (100%)
- Core module development (85%)

**Upcoming Milestones:**
- Integration testing completion (Target: March 29)
- User acceptance testing (Target: April 5)
- Production deployment (Target: April 15)

## Work Package Updates

### WP-1: Core Development (Lead: Alex Rivera)
Development is 85% complete. The contact management and opportunity tracking modules are finished and in testing. The reporting module is experiencing minor delays due to complex data aggregation requirements.

### WP-2: Integration (Lead: Priya Patel)
Integration with existing email system completed successfully. Salesforce data migration tool is 70% complete. Identified compatibility issue with legacy accounting system that requires additional development time.

### WP-3: Testing (Lead: Marcus Johnson)
Unit testing is ongoing with 92% code coverage achieved. Integration testing revealed three critical bugs that have been prioritized for immediate resolution.

## Risk Management
**New Risk Identified:** Legacy accounting system integration may require custom API development, potentially adding 2 weeks to timeline.
**Mitigation:** Escalated to steering committee; evaluating parallel workaround solution.

## Budget Status
**Budget:** $450,000
**Spent to Date:** $312,000 (69%)
**Forecast:** On budget with $8,000 contingency remaining

## Action Items
- Alex: Resolve reporting module data aggregation issues (Due: March 22)
- Priya: Complete Salesforce migration tool and begin testing (Due: March 26)
- Marcus: Retest critical bugs after fixes deployed (Due: March 21)
- Project Manager: Present integration options to steering committee (Due: March 20)

## Next Meeting
**Date:** March 26, 2024 at 2:00 PM`,
  content: `# [Project Name] - Project Meeting Minutes

**Project:** [Project Name/Code]  
**Meeting Date:** [Date]  
**Meeting Time:** [Start Time] - [End Time]  
**Location:** [Meeting Location/Platform]  
**Meeting Type:** [Weekly Status/Milestone Review/Kick-off/Closure]  
**Project Phase:** [Planning/Execution/Monitoring/Closing]

## Meeting Officials
**Project Manager:** [Name]  
**Meeting Facilitator:** [Name]  
**Scribe:** [Name]

## Project Overview
**Project Start Date:** [Date]  
**Original End Date:** [Date]  
**Revised End Date:** [Date - if applicable]  
**Project Budget:** [Budget amount]  
**Current Budget Status:** [On track/Over/Under by $X]

## Attendance

**Core Project Team:**
- [Name, Role] - [Present/Absent]
- [Name, Role] - [Present/Absent]
- [Name, Role] - [Present/Absent]

**Stakeholders:**
- [Name, Organization] - [Present/Absent]
- [Name, Organization] - [Present/Absent]

**Subject Matter Experts:**
- [Name, Expertise Area] - [Present/Absent]

**Absent Members:**
- [Name] - [Reason for absence]

## Project Status Summary

**Overall Project Health:** [Green/Yellow/Red]  
**Schedule Status:** [On track/Behind by X days/Ahead by X days]  
**Budget Status:** [On track/Over budget by $X/Under budget by $X]  
**Quality Status:** [Meeting standards/Issues identified/Exceeding expectations]

## Milestone Review

### Completed Milestones
| Milestone | Planned Date | Actual Date | Status | Notes |
|-----------|--------------|-------------|---------|-------|
| [Milestone name] | [Date] | [Date] | [Complete/Delayed] | [Brief note] |
| [Milestone name] | [Date] | [Date] | [Complete/Delayed] | [Brief note] |

### Upcoming Milestones
| Milestone | Planned Date | Confidence Level | Risk Factors |
|-----------|--------------|------------------|--------------|
| [Milestone name] | [Date] | [High/Medium/Low] | [Risk description] |
| [Milestone name] | [Date] | [High/Medium/Low] | [Risk description] |

## Work Package Updates

### [Work Package/Task Name]
**Owner:** [Team member name]  
**Planned Completion:** [Date]  
**Actual/Estimated Completion:** [Date]  
**Status:** [Not Started/In Progress/Complete/Blocked]  
**Progress:** [X% complete]

**Updates:**
- [Key accomplishment since last meeting]
- [Current activities and focus areas]
- [Challenges encountered and resolution approach]

**Dependencies:**
- [Dependency on other work packages or external factors]

## Risk Management

### Active Risks
| Risk ID | Risk Description | Impact | Probability | Owner | Mitigation Plan | Status |
|---------|------------------|---------|-------------|--------|-----------------|---------|
| R-001 | [Risk description] | [High/Med/Low] | [High/Med/Low] | [Name] | [Mitigation approach] | [Open/Mitigated] |
| R-002 | [Risk description] | [High/Med/Low] | [High/Med/Low] | [Name] | [Mitigation approach] | [Open/Mitigated] |

### New Risks Identified
- [Risk description] - **Identified by:** [Name] - **Proposed owner:** [Name]
- [Risk description] - **Identified by:** [Name] - **Proposed owner:** [Name]

### Closed Risks
- [Risk description] - **Closed date:** [Date] - **Resolution:** [How resolved]

## Issues and Blockers

### Current Issues
| Issue ID | Description | Severity | Owner | Target Resolution | Status |
|----------|-------------|----------|--------|-------------------|---------|
| I-001 | [Issue description] | [Critical/High/Med/Low] | [Name] | [Date] | [Open/In Progress] |
| I-002 | [Issue description] | [Critical/High/Med/Low] | [Name] | [Date] | [Open/In Progress] |

### Escalation Required
- [Issue requiring management/sponsor escalation]
- [Resource conflict needing executive decision]

## Resource Management

**Team Capacity:**
- [Role/Team name]: [Current capacity/utilization percentage]
- [Role/Team name]: [Current capacity/utilization percentage]

**Resource Requests:**
- [Specific resource need] - **Justification:** [Reason] - **Timeline:** [When needed]
- [Specific resource need] - **Justification:** [Reason] - **Timeline:** [When needed]

**Budget Updates:**
- [Budget category]: [Planned vs Actual spend] - [Variance explanation]
- [Budget category]: [Planned vs Actual spend] - [Variance explanation]

## Quality & Testing

**Quality Metrics:**
- [Defect rate/count]: [Current status vs target]
- [Quality gates passed]: [X of Y completed]
- [Testing progress]: [Test cases executed/passed/failed]

**Quality Issues:**
- [Quality concern] - **Impact:** [Description] - **Action:** [Planned resolution]

## Stakeholder Updates

**Client/Customer Feedback:**
- [Key feedback received]
- [Client satisfaction level]
- [Change requests or new requirements]

**Sponsor Updates:**
- [Information shared with project sponsor]
- [Sponsor decisions needed]
- [Executive support required]

## Communication Plan

**Communications Delivered Since Last Meeting:**
- [Newsletter/update sent on Date]
 - **Impact:** [Schedule/Budget/Scope impact] - **Approval date:** [Date]

## Change Management

### Approved Changes
- [Change description] - **Impact:** [Schedule/Budget/Scope impact] - **Approval date:** [Date]

### Pending Change Requests
- [Change request] - **Submitted by:** [Name] - **Status:** [Under review/Waiting approval]

## Decisions Made
1. [Decision 1] - **Decision maker:** [Name] - **Impact:** [Brief description]
2. [Decision 2] - **Decision maker:** [Name] - **Impact:** [Brief description]
3. [Decision 3] - **Decision maker:** [Name] - **Impact:** [Brief description]

## Action Items

| Action Item | Owner | Due Date | Priority | Dependencies |
|-------------|-------|----------|----------|--------------|
| [Specific action] | [Name] | [Date] | [High/Med/Low] | [What must happen first] |
| [Specific action] | [Name] | [Date] | [High/Med/Low] | [What must happen first] |
| [Specific action] | [Name] | [Date] | [High/Med/Low] | [What must happen first] |

## Next Meeting
**Date:** [Next meeting date]  
**Time:** [Meeting time]  
**Type:** [Regular status/Milestone review/Special topic]  
**Special Focus:** [Any particular areas to emphasize]

**Proposed Agenda:**
- [Milestone X review]
- [Critical path analysis]
- [Stakeholder presentation prep]

## Meeting Notes
**Additional Information:**
- [Any other relevant information discussed]
- [Parking lot items for future discussion]
- [Reference documents or materials mentioned]

**Lessons Learned / Continuous Improvement:**
- [Lesson captured]
- [Improvement opportunity]

## Next Meeting Details
**Date:** [Date] — **Time:** [Time] — **Location/Platform:** [Location]
**Primary Focus:** [Key topics or deliverables]

## Meeting Adjournment
**Meeting adjourned at:** [Time]
**Minutes prepared by:** [Name]
**Minutes distributed on:** [Date]

---

**Distribution List:**
- Project Sponsor(s)
- Core Project Team
- Key Stakeholders
- PMO Records
- [Additional distribution recipients]`,
  isCustom: false,
};
