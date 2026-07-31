import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { getDb } from "../../../db";
import { auditLog, blackoutPeriods, bookings, bookingSlots, recurrenceSeries, weeklyHours } from "../../../db/schema";
import { HttpError, isUniqueViolation } from "./errors";
import { generateRecurrence, type GeneratedOccurrence, type ManualEntryDraft } from "./recurrence";
import { RESOURCE_ID, slotStarts, validateStaffEventWindow, validateStaffHoldWindow } from "./scheduling";
import { randomToken, secretHash } from "./security";

export interface EntryOccurrenceResult {
  id?: string;
  occurrenceKey: string;
  date: string;
  time: string;
  start?: string;
  end?: string;
  reason?: string;
}

export interface EntryPreview {
  ready: EntryOccurrenceResult[];
  skipped: EntryOccurrenceResult[];
}

interface PreviewOptions {
  excludeBookingIds?: string[];
  excludeBlackoutIds?: string[];
}

export async function entrySelectionForPreview(id: string, scope: "occurrence" | "following" | "series"): Promise<PreviewOptions> {
  const db = getDb();
  const [booking] = await db.select({ id: bookings.id, seriesId: bookings.seriesId, occurrenceKey: bookings.occurrenceKey }).from(bookings).where(eq(bookings.id, id)).limit(1);
  if (booking) {
    if (scope === "occurrence" || !booking.seriesId) return { excludeBookingIds: [id] };
    const threshold = scope === "following" ? booking.occurrenceKey ?? "0000-00-00" : DateTime.now().setZone("America/Detroit").toISODate()!;
    const rows = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.seriesId, booking.seriesId), gte(bookings.occurrenceKey, threshold), inArray(bookings.status, ["confirmed", "pending_verification"])));
    return { excludeBookingIds: rows.map((row) => row.id) };
  }
  const [blackout] = await db.select({ id: blackoutPeriods.id, seriesId: blackoutPeriods.seriesId, occurrenceKey: blackoutPeriods.occurrenceKey }).from(blackoutPeriods).where(eq(blackoutPeriods.id, id)).limit(1);
  if (!blackout) throw new HttpError(404, "Entry not found.");
  if (scope === "occurrence" || !blackout.seriesId) return { excludeBlackoutIds: [id] };
  const threshold = scope === "following" ? blackout.occurrenceKey ?? "0000-00-00" : DateTime.now().setZone("America/Detroit").toISODate()!;
  const rows = await db.select({ id: blackoutPeriods.id }).from(blackoutPeriods).where(and(eq(blackoutPeriods.seriesId, blackout.seriesId), gte(blackoutPeriods.occurrenceKey, threshold)));
  return { excludeBlackoutIds: rows.map((row) => row.id) };
}

function windowFor(item: GeneratedOccurrence) {
  return { start: item.start, end: item.end };
}

export async function previewManualEntry(draft: ManualEntryDraft, options: PreviewOptions = {}): Promise<EntryPreview> {
  const generated = generateRecurrence(draft);
  const skipped: EntryOccurrenceResult[] = generated.omitted.map((item) => ({
    occurrenceKey: item.occurrenceKey,
    date: item.localDate,
    time: item.localTime,
    reason: item.reason,
  }));
  if (!generated.occurrences.length) return { ready: [], skipped };

  const db = getDb();
  const earliest = new Date(generated.occurrences[0].start);
  const latest = new Date(generated.occurrences[generated.occurrences.length - 1].end);
  const [hours, bookingConflicts, blackoutConflicts] = await Promise.all([
    db.select().from(weeklyHours),
    db.select({ id: bookings.id, startsAt: bookings.startsAt, endsAt: bookings.endsAt, groupName: bookings.groupName })
      .from(bookings).where(and(inArray(bookings.status, ["confirmed", "pending_verification"]), lt(bookings.startsAt, latest), gt(bookings.endsAt, earliest))),
    db.select({ id: blackoutPeriods.id, startsAt: blackoutPeriods.startsAt, endsAt: blackoutPeriods.endsAt })
      .from(blackoutPeriods).where(and(lt(blackoutPeriods.startsAt, latest), gt(blackoutPeriods.endsAt, earliest))),
  ]);
  const excludedBookings = new Set(options.excludeBookingIds ?? []);
  const excludedBlackouts = new Set(options.excludeBlackoutIds ?? []);
  const ready: EntryOccurrenceResult[] = [];

  for (const item of generated.occurrences) {
    const start = new Date(item.start);
    const end = new Date(item.end);
    try {
      if (draft.entryType === "event") validateStaffEventWindow(windowFor(item), hours);
      else validateStaffHoldWindow(windowFor(item));
    } catch (error) {
      skipped.push({ occurrenceKey: item.occurrenceKey, date: item.localDate, time: item.localTime, start: item.start, end: item.end, reason: error instanceof Error ? error.message : "This occurrence is not valid." });
      continue;
    }
    const booking = bookingConflicts.find((row) => !excludedBookings.has(row.id) && start < row.endsAt && end > row.startsAt);
    const blackout = blackoutConflicts.find((row) => !excludedBlackouts.has(row.id) && start < row.endsAt && end > row.startsAt);
    if (booking) {
      skipped.push({ occurrenceKey: item.occurrenceKey, date: item.localDate, time: item.localTime, start: item.start, end: item.end, reason: `Conflicts with ${booking.groupName}.` });
    } else if (blackout) {
      skipped.push({ occurrenceKey: item.occurrenceKey, date: item.localDate, time: item.localTime, start: item.start, end: item.end, reason: "Conflicts with an existing store hold." });
    } else {
      ready.push({ occurrenceKey: item.occurrenceKey, date: item.localDate, time: item.localTime, start: item.start, end: item.end });
    }
  }
  return { ready, skipped };
}

async function createOne(draft: ManualEntryDraft, item: EntryOccurrenceResult, seriesId: string | null): Promise<EntryOccurrenceResult> {
  if (!item.start || !item.end) throw new HttpError(500, "Occurrence is missing its time range.");
  const db = getDb();
  const start = new Date(item.start);
  const end = new Date(item.end);
  try {
    return await db.transaction(async (tx) => {
      const [bookingConflict] = await tx.select({ id: bookings.id, groupName: bookings.groupName }).from(bookings).where(and(
        inArray(bookings.status, ["confirmed", "pending_verification"]), lt(bookings.startsAt, end), gt(bookings.endsAt, start),
      )).limit(1);
      const [blackoutConflict] = await tx.select({ id: blackoutPeriods.id }).from(blackoutPeriods).where(and(
        lt(blackoutPeriods.startsAt, end), gt(blackoutPeriods.endsAt, start),
      )).limit(1);
      if (bookingConflict) throw new HttpError(409, `Conflicts with ${bookingConflict.groupName}.`);
      if (blackoutConflict) throw new HttpError(409, "Conflicts with an existing store hold.");

      if (draft.entryType === "event") {
        const now = new Date();
        const [row] = await tx.insert(bookings).values({
          resourceId: RESOURCE_ID,
          groupName: draft.event.groupName,
          category: draft.event.category,
          contactName: draft.event.contactName,
          email: draft.event.email,
          phone: draft.event.phone,
          privateNotes: draft.event.privateNotes,
          status: "confirmed",
          source: "admin_manual",
          seriesId,
          occurrenceKey: item.occurrenceKey,
          startsAt: start,
          endsAt: end,
          manageTokenHash: secretHash(randomToken()),
          confirmedAt: now,
        }).returning({ id: bookings.id });
        await tx.insert(bookingSlots).values(slotStarts(start, end).map((slotStart) => ({ bookingId: row.id, resourceId: RESOURCE_ID, slotStart })));
        await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", action: "manual_event_created", entityType: "booking", entityId: row.id, metadata: { seriesId, occurrenceKey: item.occurrenceKey } });
        return { ...item, id: row.id };
      }

      const [row] = await tx.insert(blackoutPeriods).values({
        startsAt: start,
        endsAt: end,
        reason: draft.hold.reason,
        seriesId,
        occurrenceKey: item.occurrenceKey,
      }).returning({ id: blackoutPeriods.id });
      await tx.insert(bookingSlots).values(slotStarts(start, end).map((slotStart) => ({ blackoutId: row.id, resourceId: RESOURCE_ID, slotStart })));
      await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", action: "store_hold_created", entityType: "blackout", entityId: row.id, metadata: { seriesId, occurrenceKey: item.occurrenceKey } });
      return { ...item, id: row.id };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw new HttpError(409, "Another entry claimed part of this time while the series was being created.");
    throw error;
  }
}

export async function createManualEntry(draft: ManualEntryDraft): Promise<{ seriesId: string | null; created: EntryOccurrenceResult[]; skipped: EntryOccurrenceResult[] }> {
  const preview = await previewManualEntry(draft);
  if (!preview.ready.length) return { seriesId: null, created: [], skipped: preview.skipped };
  const db = getDb();
  let seriesId: string | null = null;
  if (draft.recurrence.frequency !== "none") {
    const details = draft.entryType === "event" ? draft.event : draft.hold;
    const [series] = await db.insert(recurrenceSeries).values({
      entryType: draft.entryType,
      localStartTime: draft.startTime,
      durationMinutes: draft.durationMinutes,
      recurrenceRule: { startDate: draft.startDate, ...draft.recurrence },
      details,
    }).returning({ id: recurrenceSeries.id });
    seriesId = series.id;
  }

  const created: EntryOccurrenceResult[] = [];
  const skipped = [...preview.skipped];
  for (const item of preview.ready) {
    try {
      created.push(await createOne(draft, item, seriesId));
    } catch (error) {
      skipped.push({ ...item, reason: error instanceof Error ? error.message : "This occurrence could not be created." });
    }
  }
  if (seriesId && !created.length) await db.delete(recurrenceSeries).where(eq(recurrenceSeries.id, seriesId));
  return { seriesId: created.length ? seriesId : null, created, skipped };
}
