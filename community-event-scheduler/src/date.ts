export const STORE_TIMEZONE = "America/Detroit";

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date = new Date()): string {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return isoDate(copy);
}

export function moveWeek(weekStart: string, amount: number): string {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + amount * 7);
  return isoDate(date);
}

export function dateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function toLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromStoreLocalInput(value: string): string {
  const [date, time] = value.split("T");
  if (!date || !time) throw new Error("Choose a valid date and time.");
  // Determine the store's UTC offset at this wall-clock time without relying on the visitor's timezone.
  const guess = new Date(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    timeZoneName: "longOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const offsetName = formatter.formatToParts(guess).find((part) => part.type === "timeZoneName")?.value ?? "GMT-05:00";
  const offset = offsetName.replace("GMT", "") || "+00:00";
  return new Date(`${date}T${time}:00${offset}`).toISOString();
}
