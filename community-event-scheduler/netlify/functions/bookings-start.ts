import type { Config, Context } from "@netlify/functions";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "../../db";
import { auditLog, blackoutPeriods, bookings, bookingSlots, verificationChallenges, weeklyHours } from "../../db/schema";
import { cleanupExpired } from "./_shared/cleanup";
import { HttpError, isUniqueViolation } from "./_shared/errors";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { sendVerification } from "./_shared/mailer";
import { RESOURCE_ID, validateBookingWindow } from "./_shared/scheduling";
import { enforceRateLimit, randomCode, randomToken, secretHash, verifyTurnstile } from "./_shared/security";
import { bookingInputSchema } from "./_shared/validation";
import { env, isNetlifyRuntime } from "./_shared/env";

export default async (request: Request, context: Context) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  let bookingId: string | undefined;
  try {
    const input = bookingInputSchema.parse(await readJson(request));
    await Promise.all([
      verifyTurnstile(input.turnstileToken, context.ip),
      enforceRateLimit("booking_start_ip", context.ip, 10, 60),
      enforceRateLimit("booking_start_email", input.email, 5, 60),
    ]);
    await cleanupExpired();
    const db = getDb();
    const start = new Date(input.start);
    const end = new Date(input.end);
    const [hours, blackouts] = await Promise.all([
      db.select().from(weeklyHours),
      db.select().from(blackoutPeriods).where(and(lt(blackoutPeriods.startsAt, end), gt(blackoutPeriods.endsAt, start))),
    ]);
    const window = validateBookingWindow(input, hours, blackouts);
    const code = randomCode();
    const manageToken = randomToken();
    const expiresAt = new Date(Date.now() + 10 * 60_000);

    try {
      const result = await db.transaction(async (tx) => {
        const [booking] = await tx.insert(bookings).values({
          resourceId: RESOURCE_ID,
          groupName: input.groupName,
          category: input.category,
          contactName: input.contactName,
          email: input.email,
          phone: input.phone,
          privateNotes: input.privateNotes,
          startsAt: window.start,
          endsAt: window.end,
          manageTokenHash: secretHash(manageToken),
          expiresAt,
        }).returning({ id: bookings.id });
        await tx.insert(bookingSlots).values(window.slots.map((slotStart) => ({ bookingId: booking.id, resourceId: RESOURCE_ID, slotStart })));
        const [challenge] = await tx.insert(verificationChallenges).values({ bookingId: booking.id, codeHash: secretHash(code), expiresAt }).returning({ id: verificationChallenges.id });
        await tx.insert(auditLog).values({ actorType: "public", ipAddress: context.ip, action: "booking_started", entityType: "booking", entityId: booking.id, metadata: { category: input.category } });
        return { booking, challenge };
      });
      bookingId = result.booking.id;
      await sendVerification(input.email, code, input.groupName);
      return json({
        bookingId: result.booking.id,
        challengeId: result.challenge.id,
        expiresAt: expiresAt.toISOString(),
        ...(!isNetlifyRuntime() && env("MAIL_MODE") === "console" ? { devCode: code } : {}),
      }, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, "Someone just reserved part of that time. Please choose another open block.");
      throw error;
    }
  } catch (error) {
    if (bookingId) {
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx.delete(bookingSlots).where(eq(bookingSlots.bookingId, bookingId!));
        await tx.update(bookings).set({ status: "expired", updatedAt: new Date() }).where(eq(bookings.id, bookingId!));
      }).catch(console.error);
      if (!(error instanceof HttpError)) error = new HttpError(503, "We could not send the verification email. Your time was released; please try again.");
    }
    return handleError(error);
  }
};

export const config: Config = { path: "/api/bookings/start" };
