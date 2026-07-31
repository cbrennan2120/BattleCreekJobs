import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { adminSessions, bookings, bookingSlots, rateLimits } from "../../../db/schema";

export async function cleanupExpired(now = new Date()): Promise<number> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const expired = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.status, "pending_verification"), lt(bookings.expiresAt, now)));
    if (expired.length) {
      const ids = expired.map((row) => row.id);
      for (const id of ids) await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, id));
      for (const id of ids) await tx.update(bookings).set({ status: "expired", updatedAt: now }).where(eq(bookings.id, id));
    }
    await tx.delete(adminSessions).where(lt(adminSessions.expiresAt, now));
    await tx.delete(rateLimits).where(lt(rateLimits.expiresAt, now));
    return expired.length;
  });
}
