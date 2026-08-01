import type { Config, Context } from "@netlify/functions";
import { asc, eq, gt } from "drizzle-orm";
import { DateTime } from "luxon";
import { getDb } from "../../db";
import { auditLog, bookings, weeklyHours } from "../../db/schema";
import { requireAdmin } from "./_shared/admin-auth";
import { HttpError } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { hoursSchema } from "./_shared/validation";
import { STORE_TIMEZONE } from "./_shared/scheduling";

export default async (request: Request, context: Context) => {
  try {
    if (request.method === "GET") {
      await requireAdmin(request);
      const hours = await getDb().select().from(weeklyHours).orderBy(asc(weeklyHours.dayOfWeek));
      return json({ hours });
    }
    if (request.method === "PUT") {
      await requireAdmin(request, true);
      const input = hoursSchema.parse(await readJson(request));
      if (new Set(input.hours.map((row) => row.dayOfWeek)).size !== 7) throw new HttpError(400, "Include each weekday exactly once.");
      if (input.hours.some((row) => !row.isClosed && row.opensAt >= row.closesAt)) throw new HttpError(400, "Opening time must be before closing time.");
      const db = getDb();
      const futureBookings = await db.select().from(bookings).where(gt(bookings.endsAt, new Date()));
      const hiddenBooking = futureBookings.find((booking) => {
        if (booking.status !== "confirmed" && booking.status !== "pending_verification") return false;
        const start = DateTime.fromJSDate(booking.startsAt).setZone(STORE_TIMEZONE);
        const end = DateTime.fromJSDate(booking.endsAt).setZone(STORE_TIMEZONE);
        const row = input.hours.find((item) => item.dayOfWeek === start.weekday);
        return !row || row.isClosed || start.toFormat("HH:mm") < row.opensAt || end.toFormat("HH:mm") > row.closesAt;
      });
      if (hiddenBooking) throw new HttpError(409, `These hours would hide ${hiddenBooking.groupName}. Move or cancel that booking first.`);
      await db.transaction(async (tx) => {
        for (const row of input.hours) {
          await tx.update(weeklyHours).set({ opensAt: row.opensAt, closesAt: row.closesAt, isClosed: row.isClosed, updatedAt: new Date() }).where(eq(weeklyHours.id, row.id));
        }
        await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", ipAddress: context.ip, action: "weekly_hours_updated", entityType: "settings" });
      });
      return json({ hours: await db.select().from(weeklyHours).orderBy(asc(weeklyHours.dayOfWeek)) });
    }
    return methodNotAllowed(["GET", "PUT"]);
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/admin/hours" };
