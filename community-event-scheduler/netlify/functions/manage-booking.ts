import type { Config, Context } from "@netlify/functions";
import { and, eq, gt, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { getDb } from "../../db";
import { auditLog, blackoutPeriods, bookings, bookingSlots, weeklyHours } from "../../db/schema";
import { HttpError, isUniqueViolation } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { sendChanged } from "./_shared/mailer";
import { RESOURCE_ID, STORE_TIMEZONE, validateBookingWindow } from "./_shared/scheduling";
import { secretHash } from "./_shared/security";
import { manageActionSchema } from "./_shared/validation";

function ownerView(booking: typeof bookings.$inferSelect) {
  return {
    groupName: booking.groupName,
    category: booking.category,
    contactName: booking.contactName,
    email: booking.email,
    phone: booking.phone,
    privateNotes: booking.privateNotes,
    status: booking.status,
    start: booking.startsAt.toISOString(),
    end: booking.endsAt.toISOString(),
  };
}

export default async (request: Request, context: Context) => {
  if (!request.method || !["GET", "POST"].includes(request.method)) return methodNotAllowed(["GET", "POST"]);
  try {
    const token = context.params.token;
    if (!token || token.length < 32) throw new HttpError(404, "This private reservation link is not valid.");
    const db = getDb();
    const [booking] = await db.select().from(bookings).where(eq(bookings.manageTokenHash, secretHash(token))).limit(1);
    if (!booking) throw new HttpError(404, "This private reservation link is not valid.");
    if (request.method === "GET") return json(ownerView(booking));
    if (booking.status !== "confirmed") throw new HttpError(409, "Only a confirmed reservation can be changed.");
    const input = manageActionSchema.parse(await readJson(request));
    const now = new Date();

    if (input.action === "cancel") {
      await db.transaction(async (tx) => {
        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, booking.id));
        await tx.update(bookings).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(bookings.id, booking.id));
        await tx.insert(auditLog).values({ actorType: "booker", ipAddress: context.ip, action: "booking_cancelled", entityType: "booking", entityId: booking.id });
      });
      if (booking.email) await sendChanged(booking.email, booking.groupName, "Your reservation was cancelled and the time is available again.").catch(console.error);
      return json(ownerView({ ...booking, status: "cancelled", cancelledAt: now, updatedAt: now }));
    }

    if (input.action === "update_details") {
      const details = {
        groupName: input.groupName,
        category: input.category,
        contactName: input.contactName,
        phone: input.phone ?? null,
        privateNotes: input.privateNotes ?? null,
        updatedAt: now,
      };
      const changedFields = [
        booking.groupName !== details.groupName && "event name",
        booking.category !== details.category && "category",
        booking.contactName !== details.contactName && "contact name",
        (booking.phone ?? null) !== details.phone && "phone",
        (booking.privateNotes ?? null) !== details.privateNotes && "private notes",
      ].filter((field): field is string => Boolean(field));
      let updated: typeof bookings.$inferSelect | undefined;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(bookings).set(details)
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed")))
          .returning();
        if (!updated) throw new HttpError(409, "Only a confirmed reservation can be changed.");
        await tx.insert(auditLog).values({
          actorType: "booker",
          ipAddress: context.ip,
          action: "booking_details_updated",
          entityType: "booking",
          entityId: booking.id,
          metadata: { fields: changedFields },
        });
      });
      if (!updated) throw new HttpError(409, "Only a confirmed reservation can be changed.");
      if (booking.email) {
        const summary = changedFields.length
          ? `The following reservation details were updated: ${changedFields.join(", ")}.`
          : "Your reservation details were reviewed and saved without changes.";
        await sendChanged(booking.email, updated.groupName, summary).catch(console.error);
      }
      return json(ownerView(updated));
    }

    const start = new Date(input.start);
    const end = new Date(input.end);
    const [hours, blackouts] = await Promise.all([
      db.select().from(weeklyHours),
      db.select().from(blackoutPeriods).where(and(lt(blackoutPeriods.startsAt, end), gt(blackoutPeriods.endsAt, start))),
    ]);
    const window = validateBookingWindow(input, hours, blackouts);
    try {
      await db.transaction(async (tx) => {
        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, booking.id));
        await tx.insert(bookingSlots).values(window.slots.map((slotStart) => ({ bookingId: booking.id, resourceId: RESOURCE_ID, slotStart })));
        await tx.update(bookings).set({ startsAt: window.start, endsAt: window.end, updatedAt: now }).where(eq(bookings.id, booking.id));
        await tx.insert(auditLog).values({ actorType: "booker", ipAddress: context.ip, action: "booking_rescheduled", entityType: "booking", entityId: booking.id });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, "Someone just reserved part of that time. Your original reservation was not changed.");
      throw error;
    }
    const startLabel = DateTime.fromJSDate(window.start).setZone(STORE_TIMEZONE).toFormat("cccc, LLLL d 'at' h:mm a");
    const endLabel = DateTime.fromJSDate(window.end).setZone(STORE_TIMEZONE).toFormat("h:mm a");
    if (booking.email) await sendChanged(booking.email, booking.groupName, `Your reservation was moved to ${startLabel}–${endLabel}.`).catch(console.error);
    return json(ownerView({ ...booking, startsAt: window.start, endsAt: window.end, updatedAt: now }));
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/manage/:token" };
