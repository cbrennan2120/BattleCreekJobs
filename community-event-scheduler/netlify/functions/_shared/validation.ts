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

export const manageDetailsSchema = bookingInputSchema.pick({
  groupName: true,
  category: true,
  contactName: true,
  phone: true,
  privateNotes: true,
}).extend({ action: z.literal("update_details") }).strict();

export const manageActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  rescheduleSchema,
  manageDetailsSchema,
]);

export const hoursSchema = z.object({
  hours: z.array(z.object({
    id: z.string().uuid(),
    dayOfWeek: z.number().int().min(1).max(7),
    opensAt: z.string().regex(/^([01]\d|2[0-3]):00$/),
    closesAt: z.string().regex(/^([01]\d|2[0-3]):00$/),
    isClosed: z.boolean(),
  })).length(7),
});

export const blackoutSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(2).max(200),
});

const recurrenceEndSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("until"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ type: z.literal("count"), count: z.number().int().min(1).max(200) }),
]);

export const recurrenceRuleSchema = z.union([
  z.object({ frequency: z.literal("none") }),
  z.object({ frequency: z.literal("daily"), interval: z.number().int().min(1).max(30), end: recurrenceEndSchema }),
  z.object({
    frequency: z.literal("weekly"),
    interval: z.number().int().min(1).max(12),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).transform((days) => Array.from(new Set(days))),
    end: recurrenceEndSchema,
  }),
  z.object({
    frequency: z.literal("monthly"),
    interval: z.number().int().min(1).max(12),
    mode: z.literal("day_of_month"),
    dayOfMonth: z.number().int().min(1).max(31),
    end: recurrenceEndSchema,
  }),
  z.object({
    frequency: z.literal("monthly"),
    interval: z.number().int().min(1).max(12),
    mode: z.literal("ordinal_weekday"),
    ordinal: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    weekday: z.number().int().min(1).max(7),
    end: recurrenceEndSchema,
  }),
]);

const eventDetailsSchema = z.object({
  groupName: z.string().trim().min(2).max(100),
  category: z.enum(CATEGORY_VALUES),
  contactName: z.string().trim().max(100).optional().transform((value) => value || undefined),
  email: z.string().trim().email().max(254).optional().transform((value) => value?.toLowerCase() || undefined),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  privateNotes: z.string().trim().max(1000).optional().transform((value) => value || undefined),
});

const manualScheduleSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):00$/),
  durationMinutes: z.number().int().min(60).max(1440).refine((value) => value % 60 === 0, "Duration must use one-hour blocks."),
  recurrence: recurrenceRuleSchema,
});

export const manualEntrySchema = z.discriminatedUnion("entryType", [
  manualScheduleSchema.extend({ entryType: z.literal("event"), event: eventDetailsSchema }),
  manualScheduleSchema.extend({ entryType: z.literal("hold"), hold: z.object({ reason: z.string().trim().min(2).max(200) }) }),
]).superRefine((entry, context) => {
  if (entry.entryType === "event" && entry.durationMinutes > 240) {
    context.addIssue({ code: "custom", path: ["durationMinutes"], message: "Events may last up to four hours." });
  }
});

export const manualEntryUpdateSchema = z.object({
  scope: z.enum(["occurrence", "following", "series"]),
  draft: manualEntrySchema,
});
