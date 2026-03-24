export type MakeDeeplinkParams = {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
};

export function makeGcalDeeplink({
  title,
  start,
  end,
  description = "",
  location = "",
}: MakeDeeplinkParams) {
  const baseUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const params = [
    `text=${encodeURIComponent(title)}`,
    `dates=${formatDate(start)}/${formatDate(end)}`,
    `details=${encodeURIComponent(description)}`,
    `location=${encodeURIComponent(location)}`,
  ];

  return `${baseUrl}&${params.join("&")}`;
}

export function makeOutlookDeeplinkForSouthAfrica({
  title,
  start,
  end,
  description = "",
  location = "",
}: MakeDeeplinkParams) {
  const baseUrl =
    "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose";
  const params = [
    `subject=${encodeURIComponent(title)}`,
    `startdt=${encodeURIComponent(formatDateInSouthAfrica(start))}`,
    `enddt=${encodeURIComponent(formatDateInSouthAfrica(end))}`,
    `body=${encodeURIComponent(description.replace(/\n/g, "\r\n"))}`,
    `location=${encodeURIComponent(location)}`,
    "timezone=Africa/Johannesburg",
  ];

  return `${baseUrl}&${params.join("&")}`;
}

// This downloads a file with the .ics extension.  Name the file like <a download="event.ics">
export function makeIcalDeeplink({
  title,
  start,
  end,
  description = "",
  location = "",
}: MakeDeeplinkParams) {
  const escape = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const formatICSDate = (date: Date) => {
    const pad = (num: number) => String(num).padStart(2, "0");
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z"
    );
  };

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YourCompany//YourApp//EN",
    "BEGIN:VEVENT",
    `SUMMARY:${escape(title)}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `DESCRIPTION:${escape(description)}`,
    `LOCATION:${escape(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;
}

// Converts to UTC format: YYYYMMDDTHHMMSSZ
function formatDate(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function formatDateInSouthAfrica(date: Date): string {
  // Converts a UTC date into local South African time (no Z suffix, Outlook-style)
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date).reduce(
    (acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
