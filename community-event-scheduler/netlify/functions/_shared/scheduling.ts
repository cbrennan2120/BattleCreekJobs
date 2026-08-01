import { DateTime } from "luxon";
import type { BookingRow, WeeklyHoursRow } from "../../../db/schema";
import { HttpError } from "./errors";

export const STORE_TIMEZONE = "America/Detroit";
export const RESOURCE_ID = "battle-creek-event-space";
export const SLOT_MINUTES = 60;
export const MAX_DURATION_MINUTES = 240;
export const MIN_NOTICE_HOURS = 24;
export const MAX_HORIZON_DAYS = 90;

export interface BlackoutLike { startsAt: Date; endsAt: Date }
export interface BookingWindow { start: string; end: string }

function local(instant: Date | string): DateTime {
  return (instant instanceof Date ? DateTime.fromJSDate(instant) : DateTime.fromISO(instant, { setZone: true })).setZone(STORE_TIMEZONE);
}

export function slotStarts(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += SLOT_MINUTES * 60_000) result.push(new Date(cursor));
  return result;
}

function parseWindow(window: BookingWindow, maximumMinutes: number, kind: "reservation" | "hold") {
  const start = new Date(window.start);
  const end = new Date(window.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new HttpError(400, "Choose a valid start and end time.");
  const localStart = local(start);
  const localEnd = local(end);
  const milliseconds = end.getTime() - start.getTime();
  if (milliseconds < SLOT_MINUTES * 60_000 || milliseconds > maximumMinutes * 60_000 || milliseconds % (SLOT_MINUTES * 60_000) !== 0) {
    const limit = kind === "hold" ? "24 hours" : "four hours";
    throw new HttpError(400, `${kind === "hold" ? "Holds" : "Reservations"} must use consecutive one-hour blocks and may last up to ${limit}.`);
  }
  if (localStart.toISODate() !== localEnd.minus({ milliseconds: 1 }).toISODate()) throw new HttpError(400, `A ${kind} must start and end on the same store day.`);
  if (localStart.minute !== 0 || localStart.second !== 0 || localEnd.minute !== 0 || localEnd.second !== 0) throw new HttpError(400, "Start and end times must fall on a whole-hour boundary.");
  return { start, end, localStart, localEnd, slots: slotStarts(start, end) };
}

function requireStoreHours(
  parsed: ReturnType<typeof parseWindow>,
  hours: Pick<WeeklyHoursRow, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">[],
): void {
  const dayHours = hours.find((row) => row.dayOfWeek === parsed.localStart.weekday);
  if (!dayHours || dayHours.isClosed) throw new HttpError(409, "The event space is closed that day.");
  const opens = DateTime.fromISO(`${parsed.localStart.toISODate()}T${dayHours.opensAt}`, { zone: STORE_TIMEZONE });
  const closes = DateTime.fromISO(`${parsed.localStart.toISODate()}T${dayHours.closesAt}`, { zone: STORE_TIMEZONE });
  if (parsed.localStart < opens || parsed.localEnd > closes) throw new HttpError(409, "That time falls outside the available event hours.");
}

export function validateBookingWindow(
  window: BookingWindow,
  hours: Pick<WeeklyHoursRow, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">[],
  blackouts: BlackoutLike[],
  now = new Date(),
): { start: Date; end: Date; slots: Date[] } {
  const parsed = parseWindow(window, MAX_DURATION_MINUTES, "reservation");
  if (parsed.start.getTime() < now.getTime() + MIN_NOTICE_HOURS * 3_600_000) throw new HttpError(400, "Reservations require at least 24 hours’ notice.");
  if (parsed.start.getTime() > now.getTime() + MAX_HORIZON_DAYS * 86_400_000) throw new HttpError(400, "Reservations may be made up to 90 days ahead.");
  requireStoreHours(parsed, hours);
  if (blackouts.some((blackout) => parsed.start < blackout.endsAt && parsed.end > blackout.startsAt)) throw new HttpError(409, "That time is unavailable because the store has blocked part of it.");
  return { start: parsed.start, end: parsed.end, slots: parsed.slots };
}

export function validateStaffEventWindow(
  window: BookingWindow,
  hours: Pick<WeeklyHoursRow, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">[],
): { start: Date; end: Date; slots: Date[] } {
  const parsed = parseWindow(window, MAX_DURATION_MINUTES, "reservation");
  requireStoreHours(parsed, hours);
  return { start: parsed.start, end: parsed.end, slots: parsed.slots };
}

export function validateStaffHoldWindow(window: BookingWindow): { start: Date; end: Date } {
  const parsed = parseWindow(window, 1440, "hold");
  return { start: parsed.start, end: parsed.end };
}

export interface PublicSlot {
  start: string;
  end: string;
  state: "available" | "pending" | "booked" | "blackout";
  groupName?: string;
  category?: string;
}

export function generateAvailability(
  weekStart: string,
  hours: Pick<WeeklyHoursRow, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">[],
  blackouts: BlackoutLike[],
  activeBookings: BookingRow[],
  now = new Date(),
): PublicSlot[] {
  const firstDay = DateTime.fromISO(weekStart, { zone: STORE_TIMEZONE }).startOf("day");
  if (!firstDay.isValid) throw new HttpError(400, "weekStart must be a valid date.");
  const result: PublicSlot[] = [];
  const firstBookable = now.getTime() + MIN_NOTICE_HOURS * 3_600_000;
  const lastBookable = now.getTime() + MAX_HORIZON_DAYS * 86_400_000;

  for (let offset = 0; offset < 7; offset += 1) {
    const day = firstDay.plus({ days: offset });
    const dayHours = hours.find((row) => row.dayOfWeek === day.weekday);
    if (!dayHours || dayHours.isClosed) continue;
    let cursor = DateTime.fromISO(`${day.toISODate()}T${dayHours.opensAt}`, { zone: STORE_TIMEZONE });
    const close = DateTime.fromISO(`${day.toISODate()}T${dayHours.closesAt}`, { zone: STORE_TIMEZONE });
    while (cursor < close) {
      const next = cursor.plus({ minutes: SLOT_MINUTES });
      const start = cursor.toJSDate();
      const end = next.toJSDate();
      const blackout = blackouts.some((item) => start < item.endsAt && end > item.startsAt);
      const booking = activeBookings.find((item) => start < item.endsAt && end > item.startsAt);
      if (blackout) result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "blackout" });
      else if (booking?.status === "confirmed") result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "booked", groupName: booking.groupName, category: booking.category });
      else if (booking?.status === "pending_verification") result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "pending" });
      else if (start.getTime() >= firstBookable && start.getTime() <= lastBookable) result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "available" });
      cursor = next;
    }
  }
  return result;
}
