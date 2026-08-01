import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyHours = pgTable("weekly_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayOfWeek: integer("day_of_week").notNull(),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("weekly_hours_day_unique").on(table.dayOfWeek)]);

export const recurrenceSeries = pgTable("recurrence_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryType: text("entry_type").notNull(),
  timezone: text("timezone").notNull().default("America/Detroit"),
  localStartTime: text("local_start_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  recurrenceRule: jsonb("recurrence_rule").notNull(),
  details: jsonb("details").notNull(),
  status: text("status").notNull().default("active"),
  createdAt,
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("recurrence_series_status_idx").on(table.status)]);

export const blackoutPeriods = pgTable("blackout_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  seriesId: uuid("series_id").references(() => recurrenceSeries.id),
  occurrenceKey: text("occurrence_key"),
  isException: boolean("is_exception").notNull().default(false),
  createdAt,
}, (table) => [
  index("blackout_periods_range_idx").on(table.startsAt, table.endsAt),
  uniqueIndex("blackout_series_occurrence_unique").on(table.seriesId, table.occurrenceKey),
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: text("resource_id").notNull().default("battle-creek-event-space"),
  groupName: text("group_name").notNull(),
  category: text("category").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  privateNotes: text("private_notes"),
  status: text("status").notNull().default("pending_verification"),
  source: text("source").notNull().default("public"),
  seriesId: uuid("series_id").references(() => recurrenceSeries.id),
  occurrenceKey: text("occurrence_key"),
  isException: boolean("is_exception").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  manageTokenHash: text("manage_token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt,
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bookings_range_idx").on(table.startsAt, table.endsAt),
  index("bookings_status_idx").on(table.status),
  index("bookings_email_idx").on(table.email),
  uniqueIndex("bookings_series_occurrence_unique").on(table.seriesId, table.occurrenceKey),
]);

export const bookingSlots = pgTable("booking_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  blackoutId: uuid("blackout_id").references(() => blackoutPeriods.id, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull(),
  slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
  createdAt,
}, (table) => [
  uniqueIndex("booking_slots_resource_start_unique").on(table.resourceId, table.slotStart),
  index("booking_slots_booking_idx").on(table.bookingId),
  index("booking_slots_blackout_idx").on(table.blackoutId),
]);

export const verificationChallenges = pgTable("verification_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt,
}, (table) => [index("verification_booking_idx").on(table.bookingId)]);

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  csrfTokenHash: text("csrf_token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt,
}, (table) => [index("admin_sessions_expiry_idx").on(table.expiresAt)]);

export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  keyHash: text("key_hash").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [uniqueIndex("rate_limits_action_key_window_unique").on(table.action, table.keyHash, table.windowStart)]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: text("actor_type").notNull(),
  actorLabel: text("actor_label"),
  ipAddress: text("ip_address"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  createdAt,
}, (table) => [index("audit_log_created_idx").on(table.createdAt)]);

export type BookingRow = typeof bookings.$inferSelect;
export type WeeklyHoursRow = typeof weeklyHours.$inferSelect;
