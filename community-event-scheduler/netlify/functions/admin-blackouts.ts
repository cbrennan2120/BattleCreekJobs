import type { Config, Context } from "@netlify/functions";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb } from "../../db";
import { auditLog, blackoutPeriods, bookings } from "../../db/schema";
import { requireAdmin } from "./_shared/admin-auth";
import { HttpError } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { blackoutSchema } from "./_shared/validation";

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
      if (endsAt <= startsAt) throw new HttpError(400, "Blackout end time must be after its start time.");
      const db = getDb();
      const [conflict] = await db.select({ id: bookings.id, groupName: bookings.groupName }).from(bookings).where(and(
        inArray(bookings.status, ["confirmed", "pending_verification"]),
        lt(bookings.startsAt, endsAt),
        gt(bookings.endsAt, startsAt),
      )).limit(1);
      if (conflict) throw new HttpError(409, `This blackout overlaps ${conflict.groupName}. Move or cancel that booking first.`);
      const [row] = await db.insert(blackoutPeriods).values({ startsAt, endsAt, reason: input.reason }).returning();
      await db.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", action: "blackout_created", entityType: "blackout", entityId: row.id, metadata: { reason: row.reason } });
      return json({ blackout: row }, { status: 201 });
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
