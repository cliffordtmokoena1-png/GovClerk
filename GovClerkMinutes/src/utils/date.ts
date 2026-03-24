import { assert } from "./assert";

export function asUtcDate(dateString: string): Date {
  assert(/^[0-9]{4}-[0-9]{2}-[0-9]{2} ..:..:../.test(dateString));
  return new Date(dateString.replace(" ", "T") + "Z");
}

export function convertDateForMysql(date: Date): string {
  return convertIsoTimestampForMysql(date.toISOString());
}

export function convertIsoTimestampForMysql(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function convertIsoTimestampFromMysql(timestamp: string): string {
  return new Date(timestamp.replace(" ", "T") + "Z").toISOString();
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseDate(date: Date | string | number | null | undefined): Date | null {
  if (!date) {
    return null;
  }

  let dateObj: Date;

  if (typeof date === "string" && date.includes("-") && date.includes(":")) {
    dateObj = new Date(date.replace(" ", "T") + "Z");
  } else if (date instanceof Date) {
    dateObj = new Date(date.getTime());
  } else {
    dateObj = new Date(date);
  }

  return isNaN(dateObj.getTime()) ? null : dateObj;
}

export function humanReadableDuration(date: Date | string | number | null | undefined): string {
  const dateObj = parseDate(date);

  if (!dateObj) {
    return "Recently";
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 6) {
    try {
      return dateObj.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  if (days === 1) {
    return `${days} day`;
  }
  if (days > 0) {
    return `${days} days`;
  }
  if (hours === 1) {
    return `${hours} hour`;
  }
  if (hours > 0) {
    return `${hours} hours`;
  }
  if (minutes === 1) {
    return `${minutes} min`;
  }
  if (minutes > 0) {
    return `${minutes} mins`;
  }
  return "1 min";
}

export function getFullDateString(date: Date | string | number | null | undefined): string {
  const dateObj = parseDate(date);

  if (!dateObj) {
    return "Unknown date";
  }

  return (
    dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}
