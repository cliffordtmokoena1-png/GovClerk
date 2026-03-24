import type { PublicMeetingListItem } from "@/types/portal";
import type { MeetingsFilter } from "../public";

export const PREVIEW_PAGE_SIZE = 10;

const today = new Date();

export const SAMPLE_MEETINGS: PublicMeetingListItem[] = [
  {
    id: 1,
    title: "City Council Regular Meeting",
    description:
      "Monthly city council meeting to discuss community matters, budget updates, and new ordinances.",
    meetingDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["City Council", "Public Hearing"],
    isCancelled: false,
    artifacts: [
      {
        id: 101,
        orgId: "org-1",
        portalMeetingId: 1,
        artifactType: "agenda_pdf",
        fileName: "agenda-1.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/1/agenda.pdf",
        s3Url: "https://example.com/agenda-1.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 2,
    title: "Planning Commission Special Session",
    description: "Special session to review the downtown revitalization project proposals.",
    meetingDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Planning", "Zoning"],
    isCancelled: false,
    artifacts: [
      {
        id: 102,
        orgId: "org-1",
        portalMeetingId: 2,
        artifactType: "agenda_pdf",
        fileName: "agenda-2.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/2/agenda.pdf",
        s3Url: "https://example.com/agenda-2.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 3,
    title: "Budget Committee Public Hearing",
    description: "Public hearing on the proposed FY2025 municipal budget. Community input welcome.",
    meetingDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Budget", "Finance", "Public Hearing"],
    isCancelled: false,
    artifacts: [],
  },
  {
    id: 10,
    title: "Water Board Emergency Session",
    description: "Emergency session cancelled due to scheduling conflicts.",
    meetingDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Water Board", "Emergency"],
    isCancelled: true,
    artifacts: [],
  },
  {
    id: 4,
    title: "Parks & Recreation Board Meeting",
    description:
      "Discussion of summer programming, park maintenance schedules, and community events.",
    meetingDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Parks & Recreation", "Community"],
    isCancelled: false,
    artifacts: [
      {
        id: 104,
        orgId: "org-1",
        portalMeetingId: 4,
        artifactType: "minutes_pdf",
        fileName: "minutes-4.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/4/minutes.pdf",
        s3Url: "https://example.com/minutes-4.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 105,
        orgId: "org-1",
        portalMeetingId: 4,
        artifactType: "agenda_pdf",
        fileName: "agenda-4.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/4/agenda.pdf",
        s3Url: "https://example.com/agenda-4.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 5,
    title: "Transportation Advisory Committee",
    description: "Review of traffic studies and proposed bike lane expansions on Main Street.",
    meetingDate: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Transportation", "Infrastructure"],
    isCancelled: false,
    artifacts: [
      {
        id: 106,
        orgId: "org-1",
        portalMeetingId: 5,
        artifactType: "minutes_pdf",
        fileName: "minutes-5.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/5/minutes.pdf",
        s3Url: "https://example.com/minutes-5.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 107,
        orgId: "org-1",
        portalMeetingId: 5,
        artifactType: "agenda_pdf",
        fileName: "agenda-5.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/5/agenda.pdf",
        s3Url: "https://example.com/agenda-5.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 6,
    title: "City Council Regular Meeting",
    description:
      "Regular meeting covering zoning amendments, public safety updates, and community announcements.",
    meetingDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["City Council", "Zoning"],
    isCancelled: false,
    artifacts: [
      {
        id: 108,
        orgId: "org-1",
        portalMeetingId: 6,
        artifactType: "minutes_pdf",
        fileName: "minutes-6.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/6/minutes.pdf",
        s3Url: "https://example.com/minutes-6.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 109,
        orgId: "org-1",
        portalMeetingId: 6,
        artifactType: "agenda_pdf",
        fileName: "agenda-6.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/6/agenda.pdf",
        s3Url: "https://example.com/agenda-6.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 7,
    title: "Environmental Commission Meeting",
    description:
      "Quarterly review of sustainability initiatives and green infrastructure projects.",
    meetingDate: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Environment", "Sustainability"],
    isCancelled: false,
    artifacts: [
      {
        id: 110,
        orgId: "org-1",
        portalMeetingId: 7,
        artifactType: "minutes_pdf",
        fileName: "minutes-7.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/7/minutes.pdf",
        s3Url: "https://example.com/minutes-7.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 11,
    title: "Historic Preservation Board",
    description: "Meeting was cancelled due to lack of quorum.",
    meetingDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Historic Preservation"],
    isCancelled: true,
    artifacts: [],
  },
  {
    id: 8,
    title: "Youth Advisory Council",
    description: "Monthly meeting of the youth advisory council - minutes pending approval.",
    meetingDate: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Youth", "Advisory"],
    isCancelled: false,
    artifacts: [
      {
        id: 111,
        orgId: "org-1",
        portalMeetingId: 8,
        artifactType: "agenda_pdf",
        fileName: "agenda-8.pdf",
        fileSize: 1024,
        s3Key: "portal/org-1/meetings/8/agenda.pdf",
        s3Url: "https://example.com/agenda-8.pdf",
        isPublic: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
];

export function filterMeetings(
  meetings: PublicMeetingListItem[],
  search: string,
  filter: MeetingsFilter
): PublicMeetingListItem[] {
  let result = [...meetings];

  if (search) {
    const searchLower = search.toLowerCase();
    result = result.filter(
      (m) =>
        m.title.toLowerCase().includes(searchLower) ||
        (m.description?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  if (filter.year && filter.month) {
    result = result.filter((m) => {
      const date = new Date(m.meetingDate);
      return date.getFullYear() === filter.year && date.getMonth() + 1 === filter.month;
    });
  }

  if (filter.selectedTags && filter.selectedTags.length > 0) {
    result = result.filter((m) => m.tags?.some((tag) => filter.selectedTags!.includes(tag)));
  }

  result.sort((a, b) => {
    const dateA = new Date(a.meetingDate).getTime();
    const dateB = new Date(b.meetingDate).getTime();
    return filter.sortBy === "oldest" ? dateA - dateB : dateB - dateA;
  });

  return result;
}

export function paginateMeetings(
  meetings: PublicMeetingListItem[],
  page: number,
  pageSize: number = PREVIEW_PAGE_SIZE
): PublicMeetingListItem[] {
  const start = (page - 1) * pageSize;
  return meetings.slice(start, start + pageSize);
}
