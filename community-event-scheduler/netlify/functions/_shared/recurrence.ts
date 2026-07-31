import { DateTime } from "luxon";
import { HttpError } from "./errors";
import { STORE_TIMEZONE } from "./scheduling";

export const MAX_SERIES_OCCURRENCES = 200;
export const MAX_SERIES_MONTHS = 24;

export type RecurrenceEnd =
  | { type: "until"; date: string }
  | { type: "count"; count: number };

export type RecurrenceRule =
  | { frequency: "none" }
  | { frequency: "daily"; interval: number; end: RecurrenceEnd }
  | { frequency: "weekly"; interval: number; weekdays: number[]; end: RecurrenceEnd }
  | { frequency: "monthly"; interval: number; mode: "day_of_month"; dayOfMonth: number; end: RecurrenceEnd }
  | { frequency: "monthly"; interval: number; mode: "ordinal_weekday"; ordinal: number; weekday: number; end: RecurrenceEnd };

export interface EventDetails {
  groupName: string;
  category: string;
  contactName?: string;
  email?: string;
  phone?: string;
  privateNotes?: string;
}

export interface HoldDetails { reason: string }

export type ManualEntryDraft = {
  startDate: string;
  startTime: string;
  durationMinutes: number;
  recurrence: RecurrenceRule;
} & (
  | { entryType: "event"; event: EventDetails; hold?: never }
  | { entryType: "hold"; hold: HoldDetails; event?: never }
);

export interface GeneratedOccurrence {
  occurrenceKey: string;
  localDate: string;
  localTime: string;
  start: string;
  end: string;
}

export interface OmittedOccurrence {
  occurrenceKey: string;
  localDate: string;
  localTime: string;
  reason: string;
}

export interface GeneratedSeries {
  occurrences: GeneratedOccurrence[];
  omitted: OmittedOccurrence[];
}

function parseDate(value: string): DateTime {
  const date = DateTime.fromISO(value, { zone: STORE_TIMEZONE }).startOf("day");
  if (!date.isValid || date.toISODate() !== value) throw new HttpError(400, "Choose a valid start date.");
  return date;
}

function endLimit(start: DateTime, rule: Exclude<RecurrenceRule, { frequency: "none" }>): { until: DateTime; count?: number } {
  const absoluteLimit = start.plus({ months: MAX_SERIES_MONTHS }).endOf("day");
  if (rule.end.type === "count") {
    if (rule.end.count < 1 || rule.end.count > MAX_SERIES_OCCURRENCES) throw new HttpError(400, "A recurring series may contain 1 to 200 dates.");
    return { until: absoluteLimit, count: rule.end.count };
  }
  const requested = parseDate(rule.end.date).endOf("day");
  if (requested < start) throw new HttpError(400, "The repeat ending date cannot be before the first date.");
  if (requested > absoluteLimit) throw new HttpError(400, "A recurring series may span no more than 24 months.");
  return { until: requested };
}

function occurrenceFor(date: DateTime, startTime: string, durationMinutes: number): GeneratedOccurrence | OmittedOccurrence {
  const [hour, minute] = startTime.split(":").map(Number);
  const localStart = DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour, minute }, { zone: STORE_TIMEZONE });
  const occurrenceKey = date.toISODate()!;
  if (!localStart.isValid || localStart.hour !== hour || localStart.minute !== minute) {
    return { occurrenceKey, localDate: occurrenceKey, localTime: startTime, reason: "This local time does not exist because of the daylight-saving transition." };
  }
  const localEnd = localStart.plus({ minutes: durationMinutes });
  return {
    occurrenceKey,
    localDate: occurrenceKey,
    localTime: startTime,
    start: localStart.toUTC().toISO()!,
    end: localEnd.toUTC().toISO()!,
  };
}

function ordinalWeekday(year: number, month: number, weekday: number, ordinal: number): DateTime | null {
  if (ordinal === -1) {
    const last = DateTime.fromObject({ year, month }, { zone: STORE_TIMEZONE }).endOf("month").startOf("day");
    return last.minus({ days: (last.weekday - weekday + 7) % 7 });
  }
  const first = DateTime.fromObject({ year, month, day: 1 }, { zone: STORE_TIMEZONE });
  const date = first.plus({ days: (weekday - first.weekday + 7) % 7 + (ordinal - 1) * 7 });
  return date.month === month ? date : null;
}

export function generateRecurrence(draft: Pick<ManualEntryDraft, "startDate" | "startTime" | "durationMinutes" | "recurrence">): GeneratedSeries {
  const start = parseDate(draft.startDate);
  const occurrences: GeneratedOccurrence[] = [];
  const omitted: OmittedOccurrence[] = [];
  const add = (date: DateTime) => {
    const item = occurrenceFor(date, draft.startTime, draft.durationMinutes);
    if ("reason" in item) omitted.push(item); else occurrences.push(item);
  };

  if (draft.recurrence.frequency === "none") {
    add(start);
    return { occurrences, omitted };
  }

  const rule = draft.recurrence;
  const limit = endLimit(start, rule);
  const isFull = () => limit.count !== undefined && occurrences.length >= limit.count;
  const canAdd = (date: DateTime) => date <= limit.until && !isFull();

  if (rule.frequency === "daily") {
    for (let date = start; canAdd(date); date = date.plus({ days: rule.interval })) add(date);
  } else if (rule.frequency === "weekly") {
    const firstWeek = start.startOf("week");
    for (let week = firstWeek; week <= limit.until && !isFull(); week = week.plus({ weeks: rule.interval })) {
      for (const weekday of [...rule.weekdays].sort((a, b) => a - b)) {
        const date = week.plus({ days: weekday - 1 });
        if (date >= start && canAdd(date)) add(date);
      }
    }
  } else {
    const firstMonth = start.startOf("month");
    for (let month = firstMonth; month <= limit.until && !isFull(); month = month.plus({ months: rule.interval })) {
      let date: DateTime | null;
      if (rule.mode === "day_of_month") {
        const candidate = DateTime.fromObject({ year: month.year, month: month.month, day: rule.dayOfMonth }, { zone: STORE_TIMEZONE });
        date = candidate.isValid && candidate.month === month.month ? candidate.startOf("day") : null;
        if (!date) {
          const key = `${month.toFormat("yyyy-MM")}-${String(rule.dayOfMonth).padStart(2, "0")}`;
          omitted.push({ occurrenceKey: key, localDate: key, localTime: draft.startTime, reason: "That day does not exist in this month, so it is skipped." });
        }
      } else {
        date = ordinalWeekday(month.year, month.month, rule.weekday, rule.ordinal);
        if (!date) {
          const key = `${month.toFormat("yyyy-MM")}-ordinal`;
          omitted.push({ occurrenceKey: key, localDate: month.toFormat("yyyy-MM"), localTime: draft.startTime, reason: "That weekday occurrence does not exist in this month, so it is skipped." });
        }
      }
      if (date && date >= start && canAdd(date)) add(date);
    }
  }

  if (occurrences.length > MAX_SERIES_OCCURRENCES) throw new HttpError(400, "A recurring series may contain no more than 200 dates.");
  if (limit.count !== undefined && occurrences.length < limit.count) throw new HttpError(400, "That occurrence count would extend beyond the 24-month series limit.");
  return { occurrences, omitted };
}
