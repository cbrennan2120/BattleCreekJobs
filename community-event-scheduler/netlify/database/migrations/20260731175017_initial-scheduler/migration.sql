CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token_hash" text NOT NULL UNIQUE,
	"csrf_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_type" text NOT NULL,
	"actor_label" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blackout_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"resource_id" text NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" text DEFAULT 'battle-creek-event-space' NOT NULL,
	"group_name" text NOT NULL,
	"category" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"private_notes" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"manage_token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"action" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"day_of_week" integer NOT NULL,
	"opens_at" text NOT NULL,
	"closes_at" text NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_sessions_expiry_idx" ON "admin_sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" ("created_at");--> statement-breakpoint
CREATE INDEX "blackout_periods_range_idx" ON "blackout_periods" ("starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_slots_resource_start_unique" ON "booking_slots" ("resource_id","slot_start");--> statement-breakpoint
CREATE INDEX "booking_slots_booking_idx" ON "booking_slots" ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_range_idx" ON "bookings" ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" ("status");--> statement-breakpoint
CREATE INDEX "bookings_email_idx" ON "bookings" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_action_key_window_unique" ON "rate_limits" ("action","key_hash","window_start");--> statement-breakpoint
CREATE INDEX "verification_booking_idx" ON "verification_challenges" ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_hours_day_unique" ON "weekly_hours" ("day_of_week");--> statement-breakpoint
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES
  ('booking_policy', '{"timezone":"America/Detroit","slotMinutes":30,"maxDurationMinutes":240,"minNoticeHours":24,"maxHorizonDays":90}'::jsonb);
--> statement-breakpoint
INSERT INTO "weekly_hours" ("day_of_week", "opens_at", "closes_at", "is_closed") VALUES
  (1, '09:00', '21:00', false),
  (2, '09:00', '21:00', false),
  (3, '09:00', '21:00', false),
  (4, '09:00', '21:00', false),
  (5, '09:00', '21:00', false),
  (6, '09:00', '21:00', false),
  (7, '10:00', '18:00', false);
