import type { Config, Context } from "@netlify/functions";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb } from "../../db";
import { auditLog, blackoutPeriods, bookings, bookingSlots } from "../../db/schema";
import { requireAdmin } from "./_shared/admin-auth";
import { HttpError, isUniqueViolation } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { blackoutSchema } from "./_shared/validation";
import { RESOURCE_ID, slotStarts, validateStaffHoldWindow } from "./_shared/scheduling";

export default async (request: Request, context: Context) => {
  try {
    const id = context.params.id;
    if (request.method === "GET" && !id) {
      await requireAdmin(request);
      const rows = await getDb().select().from(blackoutPeriods).where(gt(blackoutPeriods.endsAt, new Date())).orderBy(asc(blackoutPeriods.startsAt));
      return json({ blackouts: rows });
    }
    if (request.method === "POST" && !id) {
      await requireAdmin(request, true);
      const input = blackoutSchema.parse(await readJson(request));
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      validateStaffHoldWindow({ start: input.startsAt, end: input.endsAt });
      const db = getDb();
      try {
        const row = await db.transaction(async (tx) => {
          const [conflict] = await tx.select({ id: bookings.id, groupName: bookings.groupName }).from(bookings).where(and(
            inArray(bookings.status, ["confirmed", "pending_verification"]),
            lt(bookings.startsAt, endsAt),
            gt(bookings.endsAt, startsAt),
          )).limit(1);
          if (conflict) throw new HttpError(409, `This blackout overlaps ${conflict.groupName}. Move or cancel that booking first.`);
          const [created] = await tx.insert(blackoutPeriods).values({ startsAt, endsAt, reason: input.reason }).returning();
          await tx.insert(bookingSlots).values(slotStarts(startsAt, endsAt).map((slotStart) => ({ blackoutId: created.id, resourceId: RESOURCE_ID, slotStart })));
          await tx.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", action: "blackout_created", entityType: "blackout", entityId: created.id, metadata: { reason: created.reason } });
          return created;
        });
        return json({ blackout: row }, { status: 201 });
      } catch (error) {
        if (error instanceof HttpError) throw error;
        if (isUniqueViolation(error)) throw new HttpError(409, "Another entry claimed part of this time. Refresh the schedule and try again.");
        throw error;
      }
    }
    if (request.method === "DELETE" && id) {
      await requireAdmin(request, true);
      const db = getDb();
      const [row] = await db.delete(blackoutPeriods).where(eq(blackoutPeriods.id, id)).returning();
      if (!row) throw new HttpError(404, "Blackout not found.");
      await db.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", action: "blackout_deleted", entityType: "blackout", entityId: id });
      return json({ ok: true });
    }
    return methodNotAllowed(["GET", "POST", "DELETE"]);
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: ["/api/admin/blackouts", "/api/admin/blackouts/:id"] };
