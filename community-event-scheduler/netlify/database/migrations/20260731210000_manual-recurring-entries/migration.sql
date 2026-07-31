CREATE TABLE "recurrence_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entry_type" text NOT NULL,
	"timezone" text DEFAULT 'America/Detroit' NOT NULL,
	"local_start_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"recurrence_rule" jsonb NOT NULL,
	"details" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "contact_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "email" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "series_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "occurrence_key" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "is_exception" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "blackout_periods" ADD COLUMN "series_id" uuid;
--> statement-breakpoint
ALTER TABLE "blackout_periods" ADD COLUMN "occurrence_key" text;
--> statement-breakpoint
ALTER TABLE "blackout_periods" ADD COLUMN "is_exception" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_slots" ALTER COLUMN "booking_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_slots" ADD COLUMN "blackout_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_series_id_recurrence_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "recurrence_series"("id");
--> statement-breakpoint
ALTER TABLE "blackout_periods" ADD CONSTRAINT "blackout_periods_series_id_recurrence_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "recurrence_series"("id");
--> statement-breakpoint
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_blackout_id_blackout_periods_id_fkey" FOREIGN KEY ("blackout_id") REFERENCES "blackout_periods"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX "recurrence_series_status_idx" ON "recurrence_series" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_series_occurrence_unique" ON "bookings" ("series_id", "occurrence_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "blackout_series_occurrence_unique" ON "blackout_periods" ("series_id", "occurrence_key");
--> statement-breakpoint
CREATE INDEX "booking_slots_blackout_idx" ON "booking_slots" ("blackout_id");
