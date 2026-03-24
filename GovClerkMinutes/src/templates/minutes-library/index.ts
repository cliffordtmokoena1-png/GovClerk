import { Template } from "@/types/Template";
import { GovClerkMinutesTemplate } from "./01-minutesgenerator";
import { standardMeetingTemplate } from "./02-standard-meeting";
import { boardMeetingTemplate } from "./03-board-meeting";
import { projectMeetingTemplate } from "./04-project-meeting";
import { teamHuddleTemplate } from "./05-team-huddle";
import { nonprofitMeetingTemplate } from "./06-nonprofit-meeting";
import { healthcareMeetingTemplate } from "./07-healthcare-meeting";
import { hrMeetingTemplate } from "./08-hr-meeting";
import { constructionMeetingTemplate } from "./09-construction-meeting";
import { academicCommitteeTemplate } from "./10-academic-committee";
import { legalMeetingTemplate } from "./11-legal-meeting";
import { clientMeetingTemplate } from "./12-client-meeting";
import { annualGeneralMeetingTemplate } from "./13-annual-general-meeting";

export {
  GovClerkMinutesTemplate,
  standardMeetingTemplate,
  boardMeetingTemplate,
  projectMeetingTemplate,
  teamHuddleTemplate,
  nonprofitMeetingTemplate,
  healthcareMeetingTemplate,
  hrMeetingTemplate,
  constructionMeetingTemplate,
  academicCommitteeTemplate,
  legalMeetingTemplate,
  clientMeetingTemplate,
  annualGeneralMeetingTemplate,
};

export const ALL_TEMPLATES: Template[] = [
  GovClerkMinutesTemplate,
  standardMeetingTemplate,
  boardMeetingTemplate,
  projectMeetingTemplate,
  teamHuddleTemplate,
  nonprofitMeetingTemplate,
  healthcareMeetingTemplate,
  hrMeetingTemplate,
  constructionMeetingTemplate,
  academicCommitteeTemplate,
  legalMeetingTemplate,
  clientMeetingTemplate,
  annualGeneralMeetingTemplate,
];

export function getTemplateById(id: string): Template | undefined {
  return ALL_TEMPLATES.find((template) => template.id === id);
}

export function getTemplatesByCategory(category: string): Template[] {
  return ALL_TEMPLATES.filter((template) => template.category === category);
}
