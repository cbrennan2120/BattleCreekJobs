import type { Config } from "@netlify/functions";
import { and, eq, gt, inArray, lt, or } from "drizzle-orm";
import { DateTime } from "luxon";
import { getDb } from "../../db";
import { blackoutPeriods, bookings, weeklyHours } from "../../db/schema";
import { handleError, json, methodNotAllowed } from "./_shared/http";
import { generateAvailability, STORE_TIMEZONE } from "./_shared/scheduling";

export default async (request: Request) => {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get("weekStart");
    const anchor = requested ? DateTime.fromISO(requested, { zone: STORE_TIMEZONE }) : DateTime.now().setZone(STORE_TIMEZONE);
    const week = anchor.startOf("week").startOf("day");
    const weekEnd = week.plus({ days: 7 });
    const db = getDb();
    const [hours, blackouts, active] = await Promise.all([
      db.select().from(weeklyHours),
      db.select().from(blackoutPeriods).where(and(lt(blackoutPeriods.startsAt, weekEnd.toJSDate()), gt(blackoutPeriods.endsAt, week.toJSDate()))),
      db.select().from(bookings).where(and(
        inArray(bookings.status, ["confirmed", "pending_verification"]),
        lt(bookings.startsAt, weekEnd.toJSDate()),
        gt(bookings.endsAt, week.toJSDate()),
        or(eq(bookings.status, "confirmed"), and(eq(bookings.status, "pending_verification"), gt(bookings.expiresAt, new Date()))),
      )),
    ]);
    return json({
      timezone: STORE_TIMEZONE,
      weekStart: week.toISODate(),
      generatedAt: new Date().toISOString(),
      slots: generateAvailability(week.toISODate()!, hours, blackouts, active),
    });
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/availability" };
