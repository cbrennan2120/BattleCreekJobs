import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { auditLog, bookings, bookingSlots } from "../../db/schema";
import { requireAdmin } from "./_shared/admin-auth";
import { HttpError } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { sendChanged } from "./_shared/mailer";

const actionSchema = z.object({ action: z.literal("cancel") });

function privateView(booking: typeof bookings.$inferSelect) {
  return {
    id: booking.id,
    groupName: booking.groupName,
    category: booking.category,
    contactName: booking.contactName,
    email: booking.email,
    phone: booking.phone,
    privateNotes: booking.privateNotes,
    status: booking.status,
    start: booking.startsAt.toISOString(),
    end: booking.endsAt.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    source: booking.source,
    seriesId: booking.seriesId,
    occurrenceKey: booking.occurrenceKey,
    isException: booking.isException,
  };
}

export default async (request: Request, context: Context) => {
  try {
    const id = context.params.id;
    if (request.method === "GET" && !id) {
      await requireAdmin(request);
      const rows = await getDb().select().from(bookings).orderBy(desc(bookings.startsAt)).limit(500);
      return json({ bookings: rows.map(privateView) });
    }
    if (request.method === "PATCH" && id) {
      await requireAdmin(request, true);
      actionSchema.parse(await readJson(request));
      const db = getDb();
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
      if (!booking) throw new HttpError(404, "Booking not found.");
      if (booking.status !== "confirmed") throw new HttpError(409, "Only confirmed bookings can be cancelled.");
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, id));
        await tx.update(bookings).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(bookings.id, id));
        await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", ipAddress: context.ip, action: "booking_cancelled", entityType: "booking", entityId: id });
      });
      if (booking.email) await sendChanged(booking.email, booking.groupName, "Store staff cancelled this reservation. Please contact Pet Supplies Plus Battle Creek if you have questions.").catch(console.error);
      return json({ booking: privateView({ ...booking, status: "cancelled", cancelledAt: now, updatedAt: now }) });
    }
    return methodNotAllowed(["GET", "PATCH"]);
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: ["/api/admin/bookings", "/api/admin/bookings/:id"] };
