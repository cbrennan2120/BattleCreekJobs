export const STORE_TIMEZONE = "America/Detroit";

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date = new Date()): string {
  const storeDate = dateKey(date.toISOString());
  const copy = new Date(`${storeDate}T12:00:00Z`);
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy.toISOString().slice(0, 10);
}

export function moveWeek(weekStart: string, amount: number): string {
  const date = new Date(`${weekStart}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount * 7);
  return date.toISOString().slice(0, 10);
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

export function addHoursToStoreInput(value: string, hours: number): string {
  const instant = new Date(fromStoreLocalInput(value));
  instant.setTime(instant.getTime() + hours * 3_600_000);
  return toLocalInput(instant.toISOString());
}

export function hoursBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

function hourInput(instant: Date, direction: "ceil" | "floor"): string {
  const local = toLocalInput(instant.toISOString());
  const minute = Number(local.slice(-2));
  const hasPartialHour = minute !== 0 || instant.getUTCSeconds() !== 0 || instant.getUTCMilliseconds() !== 0;
  if (!hasPartialHour) return local;
  const adjustment = direction === "ceil" ? 60 - minute : -minute;
  return toLocalInput(new Date(instant.getTime() + adjustment * 60_000).toISOString());
}

export function bookingInputBounds(now = new Date()): { min: string; max: string } {
  return {
    min: hourInput(new Date(now.getTime() + 24 * 3_600_000), "ceil"),
    max: hourInput(new Date(now.getTime() + 90 * 86_400_000), "floor"),
  };
}
