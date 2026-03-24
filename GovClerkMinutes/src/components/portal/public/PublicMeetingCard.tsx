import type { PublicMeetingListItem } from "@/types/portal";

interface PublicMeetingCardProps {
  meeting: PublicMeetingListItem;
  accentColor?: string;
}

/** Helper to get artifact URL by type */
function getArtifactUrl(
  meeting: PublicMeetingListItem,
  type: "minutes_pdf" | "agenda_pdf"
): string | null {
  const artifact = meeting.artifacts?.find((a) => a.artifactType === type);
  return artifact?.s3Url || null;
}

/** Check if meeting has any downloadable documents */
function hasDocuments(meeting: PublicMeetingListItem): boolean {
  return (meeting.artifacts?.length ?? 0) > 0;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isUpcoming(dateString: string): boolean {
  const meetingDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return meetingDate >= today;
}

export function PublicMeetingCard({ meeting, accentColor = "#3182CE" }: PublicMeetingCardProps) {
  const upcoming = isUpcoming(meeting.meetingDate);
  const minutesPdfUrl = getArtifactUrl(meeting, "minutes_pdf");
  const agendaPdfUrl = getArtifactUrl(meeting, "agenda_pdf");
  const hasDownloads = hasDocuments(meeting);

  return (
    <article className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
      <div className="flex flex-wrap items-start gap-2 mb-3">
        {upcoming ? (
          <span
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full"
          >
            Upcoming
          </span>
        ) : (
          <span className="inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            Past Meeting
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{meeting.title}</h3>

      <time className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {formatDate(meeting.meetingDate)}
      </time>

      {meeting.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{meeting.description}</p>
      )}

      {hasDownloads && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {minutesPdfUrl && (
            <a
              href={minutesPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              aria-label={`Download minutes for ${meeting.title}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Minutes
            </a>
          )}
          {agendaPdfUrl && (
            <a
              href={agendaPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              aria-label={`Download agenda for ${meeting.title}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Agenda
            </a>
          )}
        </div>
      )}
    </article>
  );
}
