import { useState } from "react";
import { LuChevronDown, LuFileText, LuLoader2 } from "react-icons/lu";
import type { PublicMeetingListItem } from "@/types/portal";

interface PublicMeetingRowProps {
  meeting: PublicMeetingListItem;
  accentColor?: string;
  defaultExpanded?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  portalSlug?: string;
}

/** Helper to get artifact by type */
function getArtifactByType(
  meeting: PublicMeetingListItem,
  type: "minutes_pdf" | "agenda_pdf"
): { id: number; s3Url: string; orgId: string } | null {
  const artifact = meeting.artifacts?.find((a) => a.artifactType === type);
  return artifact ? { id: artifact.id, s3Url: artifact.s3Url, orgId: artifact.orgId } : null;
}

/** Get download URL for an artifact - uses presigned URL API */
function getArtifactDownloadUrl(artifact: { id: number; orgId: string }): string {
  return `/api/portal/artifacts/${artifact.id}/download?orgId=${encodeURIComponent(artifact.orgId)}`;
}

/** Check if meeting has any downloadable documents */
function hasDocuments(meeting: PublicMeetingListItem): boolean {
  return (meeting.artifacts?.length ?? 0) > 0;
}

function getMonthAbbrev(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short" });
}

function getDay(dateString: string): number {
  return new Date(dateString).getDate();
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(dateString: string): boolean {
  const meetingDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return meetingDate >= today;
}

function getUpcomingText(dateString: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const meetingDate = new Date(dateString);
  meetingDate.setHours(0, 0, 0, 0);
  const diff = meetingDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "In 1 day";
  }
  if (days < 30) {
    return `In ${days} days`;
  }
  const months = Math.ceil(days / 30);
  if (months === 1) {
    return "In 1 month";
  }
  if (months < 12) {
    return `In ${months} months`;
  }
  const years = Math.ceil(months / 12);
  return years === 1 ? "In 1 year" : `In ${years} years`;
}

export function PublicMeetingRow({
  meeting,
  accentColor = "#3182ce",
  defaultExpanded = false,
  isFirst = false,
  isLast = false,
  portalSlug,
}: PublicMeetingRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const upcoming = isUpcoming(meeting.meetingDate);
  const minutesPdf = getArtifactByType(meeting, "minutes_pdf");
  const agendaPdf = getArtifactByType(meeting, "agenda_pdf");
  const hasDownloads = hasDocuments(meeting);

  return (
    <article className={`bg-white ${!isLast ? "border-b border-gray-200" : ""}`}>
      {/* Collapsed Row - Always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded={expanded}
        aria-controls={`meeting-${meeting.id}-details`}
      >
        {/* Date Column */}
        <div className="shrink-0 w-14 sm:w-16 text-center">
          <div className="text-xs font-medium text-gray-500 uppercase">
            {getMonthAbbrev(meeting.meetingDate)}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-700">
            {getDay(meeting.meetingDate)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-gray-200 shrink-0" />

        {/* Title and Full Date */}
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm sm:text-base font-semibold truncate ${meeting.isCancelled ? "line-through text-gray-400" : "text-gray-900"}`}
          >
            {meeting.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{formatFullDate(meeting.meetingDate)}</p>
        </div>

        {/* Status Badge */}
        <div className="shrink-0 hidden sm:flex items-center gap-2">
          {meeting.isCancelled ? (
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              Cancelled
            </span>
          ) : upcoming ? (
            <span
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full"
            >
              {getUpcomingText(meeting.meetingDate)}
            </span>
          ) : hasDownloads ? (
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              Past
            </span>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <div className="shrink-0">
          <LuChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded Details */}
      <div
        id={`meeting-${meeting.id}-details`}
        className={`transition-all duration-200 ease-out overflow-hidden ${
          expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-4 grid gap-4 sm:grid-cols-2">
            {/* Meeting Info */}
            <div>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-gray-500 shrink-0">Date:</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatFullDate(meeting.meetingDate)}
                  </dd>
                </div>
                {meeting.description && (
                  <div>
                    <dt className="text-gray-500 mb-1">Description:</dt>
                    <dd className="text-gray-700">{meeting.description}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Downloads - Now from artifacts */}
            {hasDownloads && (
              <div>
                <span className="text-sm text-gray-500 block mb-2">Documents:</span>
                <div className="flex flex-wrap gap-2">
                  {/* Minutes PDF from artifacts */}
                  {minutesPdf && (
                    <a
                      href={getArtifactDownloadUrl(minutesPdf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      aria-label={`Download minutes PDF for ${meeting.title}`}
                    >
                      <LuFileText className="h-4 w-4 text-red-600" aria-hidden="true" />
                      Minutes (PDF)
                    </a>
                  )}
                  {/* Agenda PDF from artifacts */}
                  {agendaPdf && (
                    <a
                      href={getArtifactDownloadUrl(agendaPdf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      aria-label={`Download agenda PDF for ${meeting.title}`}
                    >
                      <LuFileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      Agenda (PDF)
                    </a>
                  )}
                  {/* Additional artifacts (packets, recordings, etc.) */}
                  {meeting.artifacts
                    ?.filter((a) => !["minutes_pdf", "agenda_pdf"].includes(a.artifactType))
                    .map((artifact) => (
                      <a
                        key={artifact.id}
                        href={getArtifactDownloadUrl(artifact)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        aria-label={`Download ${artifact.fileName}`}
                      >
                        <LuFileText className="h-4 w-4 text-gray-600" aria-hidden="true" />
                        {artifact.fileName}
                      </a>
                    ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {meeting.tags && meeting.tags.length > 0 && (
              <div className="sm:col-span-2">
                <span className="text-sm text-gray-500 block mb-2">Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {meeting.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
