import type { Config, Context } from "@netlify/functions";
import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { getDb } from "../../db";
import { auditLog, bookings, bookingSlots, verificationChallenges } from "../../db/schema";
import { env } from "./_shared/env";
import { HttpError } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { sendConfirmation } from "./_shared/mailer";
import { enforceRateLimit, randomToken, safeHashMatch, secretHash } from "./_shared/security";
import { STORE_TIMEZONE } from "./_shared/scheduling";
import { verificationSchema } from "./_shared/validation";

export default async (request: Request, context: Context) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    const input = verificationSchema.parse(await readJson(request, 1024));
    await enforceRateLimit("booking_verify_ip", context.ip, 30, 15);
    await enforceRateLimit("booking_verify_challenge", input.challengeId, 8, 15);
    const db = getDb();
    const [challenge] = await db.select().from(verificationChallenges).where(eq(verificationChallenges.id, input.challengeId)).limit(1);
    if (!challenge) throw new HttpError(404, "That verification request was not found.");
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, challenge.bookingId)).limit(1);
    if (!booking || booking.status !== "pending_verification") throw new HttpError(409, "That reservation is no longer waiting for verification.");

    if (challenge.expiresAt <= new Date()) {
      await db.transaction(async (tx) => {
        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, booking.id));
        await tx.update(bookings).set({ status: "expired", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
      });
      throw new HttpError(410, "That code expired and the time was released. Please start again.");
    }
    if (challenge.attempts >= 5) throw new HttpError(429, "Too many incorrect codes. Please start a new reservation.");
    if (!safeHashMatch(input.code, challenge.codeHash)) {
      await db.update(verificationChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(verificationChallenges.id, challenge.id));
      throw new HttpError(400, "That code is not correct.");
    }

    const confirmedAt = new Date();
    const finalToken = randomToken();
    await db.transaction(async (tx) => {
      await tx.update(verificationChallenges).set({ verifiedAt: confirmedAt }).where(eq(verificationChallenges.id, challenge.id));
      const [confirmed] = await tx.update(bookings).set({ status: "confirmed", confirmedAt, expiresAt: null, manageTokenHash: secretHash(finalToken), updatedAt: confirmedAt })
        .where(and(eq(bookings.id, booking.id), eq(bookings.status, "pending_verification"))).returning({ id: bookings.id });
      if (!confirmed) throw new HttpError(409, "This reservation was already verified.");
      await tx.insert(auditLog).values({ actorType: "public", ipAddress: context.ip, action: "booking_confirmed", entityType: "booking", entityId: booking.id, metadata: { category: booking.category } });
    });

    const baseUrl = env("URL") || new URL(request.url).origin;
    const manageUrl = `${baseUrl}/manage/${encodeURIComponent(finalToken)}`;
    const start = DateTime.fromJSDate(booking.startsAt).setZone(STORE_TIMEZONE);
    const end = DateTime.fromJSDate(booking.endsAt).setZone(STORE_TIMEZONE);
    if (!booking.email) throw new HttpError(500, "The booking email is missing.");
    await sendConfirmation({
      email: booking.email,
      groupName: booking.groupName,
      category: booking.category,
      startLabel: start.toFormat("cccc, LLLL d 'at' h:mm a"),
      endLabel: end.toFormat("h:mm a"),
      manageUrl,
    }).catch((error) => console.error("Confirmation email failed", error));
    return json({ status: "confirmed", manageUrl });
  } catch (error) { return handleError(error); }
};

export const config: Config = {
  path: "/api/bookings/verify",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowLimit: 20, windowSize: 60 },
};
