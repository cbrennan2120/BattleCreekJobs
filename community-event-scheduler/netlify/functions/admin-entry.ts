import type { Config, Context } from "@netlify/functions";
import { DateTime } from "luxon";
import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { auditLog, blackoutPeriods, bookings, bookingSlots, recurrenceSeries } from "../../db/schema";
import { requireAdmin } from "./_shared/admin-auth";
import { previewManualEntry, type EntryOccurrenceResult } from "./_shared/admin-entry-service";
import { HttpError, isUniqueViolation } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { sendManualEntrySummary } from "./_shared/mailer";
import type { ManualEntryDraft } from "./_shared/recurrence";
import { RESOURCE_ID, slotStarts } from "./_shared/scheduling";
import { randomToken, secretHash } from "./_shared/security";
import { manualEntryUpdateSchema } from "./_shared/validation";

type Scope = "occurrence" | "following" | "series";

async function findTarget(id: string) {
  const db = getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (booking) return { entryType: "event" as const, row: booking };
  const [blackout] = await db.select().from(blackoutPeriods).where(eq(blackoutPeriods.id, id)).limit(1);
  if (blackout) return { entryType: "hold" as const, row: blackout };
  throw new HttpError(404, "Entry not found.");
}

async function selectedIds(target: Awaited<ReturnType<typeof findTarget>>, scope: Scope) {
  if (scope === "occurrence" || !target.row.seriesId) return target.entryType === "event"
    ? { bookingIds: [target.row.id], blackoutIds: [] as string[] }
    : { bookingIds: [] as string[], blackoutIds: [target.row.id] };
  const db = getDb();
  const threshold = scope === "following"
    ? target.row.occurrenceKey ?? "0000-00-00"
    : DateTime.now().setZone("America/Detroit").toISODate()!;
  if (target.entryType === "event") {
    const rows = await db.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.seriesId, target.row.seriesId),
      gte(bookings.occurrenceKey, threshold),
      inArray(bookings.status, ["confirmed", "pending_verification"]),
    ));
    return { bookingIds: rows.map((row) => row.id), blackoutIds: [] as string[] };
  }
  const rows = await db.select({ id: blackoutPeriods.id }).from(blackoutPeriods).where(and(
    eq(blackoutPeriods.seriesId, target.row.seriesId), gte(blackoutPeriods.occurrenceKey, threshold),
  ));
  return { bookingIds: [] as string[], blackoutIds: rows.map((row) => row.id) };
}

function detailsForEmail(draft: ManualEntryDraft) {
  return draft.entryType === "event" && draft.event.email
    ? { email: draft.event.email, groupName: draft.event.groupName }
    : null;
}

async function patchEntries(id: string, scope: Scope, draft: ManualEntryDraft, ipAddress: string) {
  const target = await findTarget(id);
  if (target.entryType !== draft.entryType) throw new HttpError(400, "Editing cannot change an event into a hold or a hold into an event.");
  const selected = await selectedIds(target, scope);
  const preview = await previewManualEntry(draft, { excludeBookingIds: selected.bookingIds, excludeBlackoutIds: selected.blackoutIds });
  const blockingConflicts = preview.skipped.filter((item) => item.start);
  if (blockingConflicts.length) return { changed: [] as EntryOccurrenceResult[], skipped: preview.skipped, unchanged: selected.bookingIds.length + selected.blackoutIds.length };
  if (!preview.ready.length) throw new HttpError(400, "The updated schedule has no dates to save.");
  const db = getDb();

  try {
    const changed = await db.transaction(async (tx) => {
      if (scope === "occurrence") {
        if (preview.ready.length !== 1) throw new HttpError(400, "A one-occurrence edit must contain one date.");
        const item = preview.ready[0];
        const start = new Date(item.start!);
        const end = new Date(item.end!);
        if (target.entryType === "event" && draft.entryType === "event") {
          await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, target.row.id));
          await tx.update(bookings).set({
            groupName: draft.event.groupName, category: draft.event.category, contactName: draft.event.contactName,
            email: draft.event.email, phone: draft.event.phone, privateNotes: draft.event.privateNotes,
            startsAt: start, endsAt: end, isException: true, updatedAt: new Date(),
          }).where(eq(bookings.id, target.row.id));
          await tx.insert(bookingSlots).values(slotStarts(start, end).map((slotStart) => ({ bookingId: target.row.id, resourceId: RESOURCE_ID, slotStart })));
        } else if (target.entryType === "hold" && draft.entryType === "hold") {
          await tx.delete(bookingSlots).where(eq(bookingSlots.blackoutId, target.row.id));
          await tx.update(blackoutPeriods).set({ startsAt: start, endsAt: end, reason: draft.hold.reason, isException: true }).where(eq(blackoutPeriods.id, target.row.id));
          await tx.insert(bookingSlots).values(slotStarts(start, end).map((slotStart) => ({ blackoutId: target.row.id, resourceId: RESOURCE_ID, slotStart })));
        }
        await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", ipAddress, action: "manual_entry_exception_updated", entityType: target.entryType, entityId: target.row.id, metadata: { scope } });
        return [{ ...item, id: target.row.id }];
      }

      await tx.delete(bookingSlots).where(inArray(bookingSlots.bookingId, selected.bookingIds.length ? selected.bookingIds : ["00000000-0000-0000-0000-000000000000"]));
      await tx.delete(bookingSlots).where(inArray(bookingSlots.blackoutId, selected.blackoutIds.length ? selected.blackoutIds : ["00000000-0000-0000-0000-000000000000"]));
      if (selected.bookingIds.length) await tx.update(bookings).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(inArray(bookings.id, selected.bookingIds));
      if (selected.blackoutIds.length) await tx.delete(blackoutPeriods).where(inArray(blackoutPeriods.id, selected.blackoutIds));
      if (target.row.seriesId) await tx.update(recurrenceSeries).set({ status: scope === "following" ? "split" : "cancelled", updatedAt: new Date() }).where(eq(recurrenceSeries.id, target.row.seriesId));

      let newSeriesId: string | null = null;
      if (draft.recurrence.frequency !== "none") {
        const [series] = await tx.insert(recurrenceSeries).values({
          entryType: draft.entryType, localStartTime: draft.startTime, durationMinutes: draft.durationMinutes,
          recurrenceRule: { startDate: draft.startDate, ...draft.recurrence },
          details: draft.entryType === "event" ? draft.event : draft.hold,
        }).returning({ id: recurrenceSeries.id });
        newSeriesId = series.id;
      }
      const result: EntryOccurrenceResult[] = [];
      for (const item of preview.ready) {
        const start = new Date(item.start!);
        const end = new Date(item.end!);
        if (draft.entryType === "event") {
          const [row] = await tx.insert(bookings).values({
            resourceId: RESOURCE_ID, groupName: draft.event.groupName, category: draft.event.category,
            contactName: draft.event.contactName, email: draft.event.email, phone: draft.event.phone, privateNotes: draft.event.privateNotes,
            status: "confirmed", source: "admin_manual", seriesId: newSeriesId, occurrenceKey: item.occurrenceKey,
            startsAt: start, endsAt: end, manageTokenHash: secretHash(randomToken()), confirmedAt: new Date(),
          }).returning({ id: bookings.id });
          await tx.insert(bookingSlots).values(slotStarts(start, end).map((slotStart) => ({ bookingId: row.id, resourceId: RESOURCE_ID, slotStart })));
          result.push({ ...item, id: row.id });
        } else {
          const [row] = await tx.insert(blackoutPeriods).values({ startsAt: start, endsAt: end, reason: draft.hold.reason, seriesId: newSeriesId, occurrenceKey: item.occurrenceKey }).returning({ id: blackoutPeriods.id });
          await tx.insert(bookingSlots).values(slotStarts(start, end).map((slotStart) => ({ blackoutId: row.id, resourceId: RESOURCE_ID, slotStart })));
          result.push({ ...item, id: row.id });
        }
      }
      await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", ipAddress, action: "manual_series_updated", entityType: draft.entryType, entityId: newSeriesId, metadata: { scope, replacedSeriesId: target.row.seriesId } });
      return result;
    });
    return { changed, skipped: preview.skipped, unchanged: 0 };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) return { changed: [] as EntryOccurrenceResult[], skipped: preview.ready.map((item) => ({ ...item, reason: "Another entry claimed this time; the original schedule was left unchanged." })), unchanged: selected.bookingIds.length + selected.blackoutIds.length };
    throw error;
  }
}

async function deleteEntries(id: string, scope: Scope, ipAddress: string) {
  const target = await findTarget(id);
  const selected = await selectedIds(target, scope);
  const db = getDb();
  const [bookingRows, blackoutRows] = await Promise.all([
    selected.bookingIds.length ? db.select({ id: bookings.id, startsAt: bookings.startsAt, endsAt: bookings.endsAt }).from(bookings).where(inArray(bookings.id, selected.bookingIds)) : Promise.resolve([]),
    selected.blackoutIds.length ? db.select({ id: blackoutPeriods.id, startsAt: blackoutPeriods.startsAt, endsAt: blackoutPeriods.endsAt }).from(blackoutPeriods).where(inArray(blackoutPeriods.id, selected.blackoutIds)) : Promise.resolve([]),
  ]);
  const changed = [...bookingRows, ...blackoutRows].map((row) => {
    const start = DateTime.fromJSDate(row.startsAt).setZone("America/Detroit");
    return { id: row.id, occurrenceKey: start.toISODate()!, date: start.toISODate()!, time: start.toFormat("HH:mm"), start: row.startsAt.toISOString(), end: row.endsAt.toISOString() };
  });
  await db.transaction(async (tx) => {
    if (selected.bookingIds.length) {
      await tx.delete(bookingSlots).where(inArray(bookingSlots.bookingId, selected.bookingIds));
      await tx.update(bookings).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(inArray(bookings.id, selected.bookingIds));
    }
    if (selected.blackoutIds.length) {
      await tx.delete(bookingSlots).where(inArray(bookingSlots.blackoutId, selected.blackoutIds));
      await tx.delete(blackoutPeriods).where(inArray(blackoutPeriods.id, selected.blackoutIds));
    }
    if (target.row.seriesId && scope !== "occurrence") await tx.update(recurrenceSeries).set({ status: scope === "following" ? "split" : "cancelled", updatedAt: new Date() }).where(eq(recurrenceSeries.id, target.row.seriesId));
    await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", ipAddress, action: "manual_entry_removed", entityType: target.entryType, entityId: id, metadata: { scope, count: selected.bookingIds.length + selected.blackoutIds.length } });
  });
  return {
    removed: selected.bookingIds.length + selected.blackoutIds.length,
    changed,
    notification: target.entryType === "event" && target.row.email ? { email: target.row.email, groupName: target.row.groupName } : null,
  };
}

export default async (request: Request, context: Context) => {
  try {
    await requireAdmin(request, true);
    const id = context.params.id;
    if (!id) throw new HttpError(400, "Entry ID is required.");
    if (request.method === "PATCH") {
      const input = manualEntryUpdateSchema.parse(await readJson(request));
      const result = await patchEntries(id, input.scope, input.draft, context.ip);
      const mail = detailsForEmail(input.draft);
      if (mail && result.changed.length) await sendManualEntrySummary({ ...mail, action: "updated", dates: result.changed.map((item) => `${item.date} at ${item.time}`), skipped: result.skipped.length }).catch(console.error);
      return json(result);
    }
    if (request.method === "DELETE") {
      const scope = new URL(request.url).searchParams.get("scope") ?? "occurrence";
      if (!(["occurrence", "following", "series"] as string[]).includes(scope)) throw new HttpError(400, "Choose a valid removal scope.");
      const result = await deleteEntries(id, scope as Scope, context.ip);
      if (result.notification) await sendManualEntrySummary({ ...result.notification, action: "cancelled", dates: [`${result.removed} scheduled date${result.removed === 1 ? "" : "s"}`] }).catch(console.error);
      return json({ removed: result.removed, changed: result.changed, skipped: [] });
    }
    return methodNotAllowed(["PATCH", "DELETE"]);
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/admin/entries/:id" };
