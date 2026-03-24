import type {
  PublicMeetingDetail as PublicMeetingDetailType,
  PortalArtifact,
} from "@/types/portal";

interface PublicMeetingDetailProps {
  meeting: PublicMeetingDetailType;
  accentColor?: string;
  portalSlug?: string;
  onBack?: () => void;
}

/** Get download URL for an artifact - uses presigned URL API */
function getArtifactDownloadUrl(artifact: PortalArtifact): string {
  return `/api/portal/artifacts/${artifact.id}/download?orgId=${encodeURIComponent(artifact.orgId)}`;
}

/** Helper to get artifact by type */
function getArtifactByType(artifacts: PortalArtifact[], type: string): PortalArtifact | undefined {
  return artifacts.find((a) => a.artifactType === type);
}

/** Get artifacts by type (for packets) */
function getArtifactsByType(artifacts: PortalArtifact[], type: string): PortalArtifact[] {
  return artifacts.filter((a) => a.artifactType === type);
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

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUpcoming(dateString: string): boolean {
  const meetingDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return meetingDate >= today;
}

export function PublicMeetingDetail({
  meeting,
  accentColor = "#3182CE",
  portalSlug,
  onBack,
}: PublicMeetingDetailProps) {
  const upcoming = isUpcoming(meeting.meetingDate);

  // Get artifacts by type
  const minutesPdf = getArtifactByType(meeting.artifacts || [], "minutes_pdf");
  const agendaPdf = getArtifactByType(meeting.artifacts || [], "agenda_pdf");
  const minutesPackets = getArtifactsByType(meeting.artifacts || [], "minutes_packet");
  const agendaPackets = getArtifactsByType(meeting.artifacts || [], "agenda_packet");
  const otherArtifacts = (meeting.artifacts || []).filter(
    (a) =>
      !["minutes_pdf", "agenda_pdf", "minutes_packet", "agenda_packet", "logo"].includes(
        a.artifactType
      )
  );

  const hasDocuments = (meeting.artifacts?.length ?? 0) > 0;
  const hasPackets = minutesPackets.length > 0 || agendaPackets.length > 0;

  return (
    <article className="max-w-3xl mx-auto">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors print:hidden"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to meetings
        </button>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {upcoming ? (
              <span
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                className="inline-block px-3 py-1 text-sm font-semibold rounded-full"
              >
                Upcoming Meeting
              </span>
            ) : (
              <span className="inline-block px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">
                Past Meeting
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{meeting.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <svg
                className="h-5 w-5"
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
              <time>{formatDate(meeting.meetingDate)}</time>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <time>{formatTime(meeting.meetingDate)}</time>
            </div>
          </div>
        </div>

        {/* Description */}
        {meeting.description && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {meeting.description}
            </p>
          </div>
        )}

        {/* Documents - Now from artifacts */}
        {hasDocuments && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>

            <div className="space-y-3">
              {/* Minutes PDF from artifacts */}
              {minutesPdf && (
                <a
                  href={getArtifactDownloadUrl(minutesPdf)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                >
                  <div
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    className="p-2 rounded-lg"
                  >
                    <svg
                      className="h-6 w-6"
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
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 group-hover:text-gray-700">
                      Meeting Minutes
                      {minutesPdf.version > 1 && (
                        <span className="text-xs text-gray-500 ml-2">(v{minutesPdf.version})</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">PDF Document</p>
                  </div>
                  <svg
                    className="h-5 w-5 text-gray-400 group-hover:text-gray-600"
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
                </a>
              )}

              {/* Agenda PDF from artifacts */}
              {agendaPdf && (
                <a
                  href={getArtifactDownloadUrl(agendaPdf)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                >
                  <div
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    className="p-2 rounded-lg"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 group-hover:text-gray-700">
                      Meeting Agenda
                      {agendaPdf.version > 1 && (
                        <span className="text-xs text-gray-500 ml-2">(v{agendaPdf.version})</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">PDF Document</p>
                  </div>
                  <svg
                    className="h-5 w-5 text-gray-400 group-hover:text-gray-600"
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
                </a>
              )}

              {/* Packet documents from artifacts */}
              {hasPackets && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Supporting Documents</h3>
                  <div className="space-y-2">
                    {[...minutesPackets, ...agendaPackets].map((artifact) => (
                      <a
                        key={artifact.id}
                        href={getArtifactDownloadUrl(artifact)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm group"
                      >
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="flex-1 text-gray-700 group-hover:text-gray-900">
                          {artifact.fileName}
                        </span>
                        <svg
                          className="h-4 w-4 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Other artifacts (recordings, etc.) */}
              {otherArtifacts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Additional Files</h3>
                  <div className="space-y-2">
                    {otherArtifacts.map((artifact) => (
                      <a
                        key={artifact.id}
                        href={getArtifactDownloadUrl(artifact)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm group"
                      >
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="flex-1 text-gray-700 group-hover:text-gray-900">
                          {artifact.fileName}
                        </span>
                        <svg
                          className="h-4 w-4 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Print button */}
        <div className="p-6 border-t border-gray-200 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print this page
          </button>
        </div>
      </div>
    </article>
  );
}
