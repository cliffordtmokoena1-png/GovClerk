export function formatTimestamp(timestamp: string): string {
  const [hours, minutes, seconds] = timestamp.split(":");

  let formattedTimestamp = "";
  if (parseInt(hours) > 0) {
    let formattedHours = parseInt(hours).toString().padStart(2, "0");
    formattedTimestamp += `${formattedHours}:`;
  }

  let formattedMinutes = parseInt(minutes).toString().padStart(2, "0");
  let formattedSeconds = parseInt(seconds).toString().padStart(2, "0");

  formattedTimestamp += `${formattedMinutes}:${formattedSeconds}`;

  return formattedTimestamp;
}

export function timestampToSeconds(timestamp: string): number {
  const [hours, minutes, seconds] = timestamp.split(":");
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

export function formatSecondsToTime(seconds: number): string {
  if (Number.isNaN(seconds) || !isFinite(seconds)) {
    return "--:--";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");
  const secondsStr = remainingSeconds.toString().padStart(2, "0");

  return hours > 0 ? `${hoursStr}:${minutesStr}:${secondsStr}` : `${minutesStr}:${secondsStr}`;
}
