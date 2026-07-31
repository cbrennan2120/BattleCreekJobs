import { z } from "zod";

export const CATEGORY_VALUES = [
  "Rescue Organization",
  "Community Event",
  "Birthday / Private Party",
  "VIP Vaccine Clinic",
  "Dog Trainer",
] as const;

export const bookingInputSchema = z.object({
  groupName: z.string().trim().min(2).max(100),
  category: z.enum(CATEGORY_VALUES),
  contactName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  privateNotes: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  turnstileToken: z.string().optional(),
});

export const verificationSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export const rescheduleSchema = z.object({
  action: z.literal("reschedule"),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

export const manageActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  rescheduleSchema,
]);

export const hoursSchema = z.object({
  hours: z.array(z.object({
    id: z.string().uuid(),
    dayOfWeek: z.number().int().min(1).max(7),
    opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    isClosed: z.boolean(),
  })).length(7),
});

export const blackoutSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(2).max(200),
});
