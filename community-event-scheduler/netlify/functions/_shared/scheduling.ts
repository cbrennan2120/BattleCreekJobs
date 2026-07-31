import { DateTime } from "luxon";
import type { BookingRow, WeeklyHoursRow } from "../../../db/schema";
import { HttpError } from "./errors";

export const STORE_TIMEZONE = "America/Detroit";
export const RESOURCE_ID = "battle-creek-event-space";
export const SLOT_MINUTES = 30;
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

export function validateBookingWindow(
  window: BookingWindow,
  hours: Pick<WeeklyHoursRow, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">[],
  blackouts: BlackoutLike[],
  now = new Date(),
): { start: Date; end: Date; slots: Date[] } {
  const start = new Date(window.start);
  const end = new Date(window.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new HttpError(400, "Choose a valid start and end time.");

  const localStart = local(start);
  const localEnd = local(end);
  const minutes = end.getTime() - start.getTime();
  if (minutes < SLOT_MINUTES * 60_000 || minutes > MAX_DURATION_MINUTES * 60_000 || minutes % (SLOT_MINUTES * 60_000) !== 0) {
    throw new HttpError(400, "Reservations must use consecutive 30-minute blocks and may last up to four hours.");
  }
  if (localStart.toISODate() !== localEnd.minus({ milliseconds: 1 }).toISODate()) throw new HttpError(400, "A reservation must start and end on the same store day.");
  if (localStart.minute % SLOT_MINUTES !== 0 || localStart.second !== 0 || localEnd.minute % SLOT_MINUTES !== 0 || localEnd.second !== 0) throw new HttpError(400, "Start and end times must fall on a 30-minute boundary.");
  if (start.getTime() < now.getTime() + MIN_NOTICE_HOURS * 3_600_000) throw new HttpError(400, "Reservations require at least 24 hours’ notice.");
  if (start.getTime() > now.getTime() + MAX_HORIZON_DAYS * 86_400_000) throw new HttpError(400, "Reservations may be made up to 90 days ahead.");

  const dayHours = hours.find((row) => row.dayOfWeek === localStart.weekday);
  if (!dayHours || dayHours.isClosed) throw new HttpError(409, "The event space is closed that day.");
  const opens = DateTime.fromISO(`${localStart.toISODate()}T${dayHours.opensAt}`, { zone: STORE_TIMEZONE });
  const closes = DateTime.fromISO(`${localStart.toISODate()}T${dayHours.closesAt}`, { zone: STORE_TIMEZONE });
  if (localStart < opens || localEnd > closes) throw new HttpError(409, "That time falls outside the available event hours.");
  if (blackouts.some((blackout) => start < blackout.endsAt && end > blackout.startsAt)) throw new HttpError(409, "That time is unavailable because the store has blocked part of it.");

  return { start, end, slots: slotStarts(start, end) };
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
): PublicSlot[] {
  const firstDay = DateTime.fromISO(weekStart, { zone: STORE_TIMEZONE }).startOf("day");
  if (!firstDay.isValid) throw new HttpError(400, "weekStart must be a valid date.");
  const result: PublicSlot[] = [];

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
      const booking = activeBookings.find((item) => start >= item.startsAt && start < item.endsAt);
      if (blackout) result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "blackout" });
      else if (booking?.status === "confirmed") result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "booked", groupName: booking.groupName, category: booking.category });
      else if (booking?.status === "pending_verification") result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "pending" });
      else result.push({ start: cursor.toUTC().toISO()!, end: next.toUTC().toISO()!, state: "available" });
      cursor = next;
    }
  }
  return result;
}
