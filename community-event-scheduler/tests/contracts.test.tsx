import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { addHoursToStoreInput, bookingInputBounds, fromStoreLocalInput, startOfWeek } from "../src/date";
import { collapseOccupiedSlots, consecutiveAvailableHours } from "../src/pages/SchedulePage";
import type { PublicSlot } from "../src/types";
import { manageActionSchema, manualEntrySchema } from "../netlify/functions/_shared/validation";

describe("database concurrency contract", () => {
  it("enforces one resource claim per hourly start", () => {
    const migrationRoot = join(process.cwd(), "netlify", "database", "migrations");
    const directory = readdirSync(migrationRoot, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && /^\d+_[a-z0-9_-]+$/.test(entry.name))?.name;
    if (!directory) throw new Error("Expected a Netlify migration directory named <number>_<slug>.");
    const sql = readFileSync(join(migrationRoot, directory, "migration.sql"), "utf8");
    expect(sql).toContain('CREATE UNIQUE INDEX "booking_slots_resource_start_unique" ON "booking_slots" ("resource_id","slot_start")');
  });

  it("adds recurrence metadata and lets holds use the same unique slot claims", () => {
    const migration = readFileSync(join(process.cwd(), "netlify", "database", "migrations", "20260731210000_manual-recurring-entries", "migration.sql"), "utf8");
    expect(migration).toContain('CREATE TABLE "recurrence_series"');
    expect(migration).toContain('ADD COLUMN "source" text DEFAULT \'public\' NOT NULL');
    expect(migration).toContain('ADD COLUMN "blackout_id" uuid');
    const schema = readFileSync(join(process.cwd(), "db", "schema.ts"), "utf8");
    expect(schema).toContain('uniqueIndex("booking_slots_resource_start_unique")');
  });
});

describe("public privacy contract", () => {
  it("keeps private manual-entry fields out of public availability types", () => {
    const scheduling = readFileSync(join(process.cwd(), "netlify", "functions", "_shared", "scheduling.ts"), "utf8");
    const publicInterface = scheduling.slice(scheduling.indexOf("export interface PublicSlot"), scheduling.indexOf("export function generateAvailability"));
    expect(publicInterface).not.toMatch(/contactName|email|phone|privateNotes|reason|seriesId|manageToken/);
  });
});

describe("public shell", () => {
  it("uses the supplied logo without upscaling and states the privacy boundary", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('width="162"');
    expect(html).toContain('height="100"');
    expect(html).toContain('alt="Pet Supplies Plus"');
    expect(html).toContain("Personal contact information is visible only to store staff");
  });

  it("interprets visitor-entered wall time in the Battle Creek timezone", () => {
    expect(fromStoreLocalInput("2026-08-10T09:00")).toBe("2026-08-10T13:00:00.000Z");
    expect(fromStoreLocalInput("2026-12-10T09:00")).toBe("2026-12-10T14:00:00.000Z");
  });

  it("calculates hourly booking inputs and Battle Creek week boundaries", () => {
    expect(addHoursToStoreInput("2026-08-10T09:00", 3)).toBe("2026-08-10T12:00");
    expect(bookingInputBounds(new Date("2026-08-01T12:30:00.000Z"))).toEqual({ min: "2026-08-02T09:00", max: "2026-10-30T08:00" });
    expect(startOfWeek(new Date("2026-08-03T02:00:00.000Z"))).toBe("2026-07-27");
    expect(startOfWeek(new Date("2026-08-03T05:00:00.000Z"))).toBe("2026-08-03");
  });

  it("collapses occupied hours and limits duration to consecutive open hours", () => {
    const slots: PublicSlot[] = [
      { start: "2026-08-10T13:00:00.000Z", end: "2026-08-10T14:00:00.000Z", state: "available" },
      { start: "2026-08-10T14:00:00.000Z", end: "2026-08-10T15:00:00.000Z", state: "available" },
      { start: "2026-08-10T15:00:00.000Z", end: "2026-08-10T16:00:00.000Z", state: "booked", groupName: "Rescue", category: "Rescue Organization" },
      { start: "2026-08-10T16:00:00.000Z", end: "2026-08-10T17:00:00.000Z", state: "booked", groupName: "Rescue", category: "Rescue Organization" },
    ];
    expect(consecutiveAvailableHours(slots[0], slots)).toBe(2);
    expect(collapseOccupiedSlots(slots)).toEqual([slots[0], slots[1], { ...slots[2], end: slots[3].end }]);
  });

  it("requires a fresh Turnstile token and resets consumed or expired challenges", () => {
    const bookingForm = readFileSync(join(process.cwd(), "src", "components", "BookingForm.tsx"), "utf8");
    const captcha = readFileSync(join(process.cwd(), "src", "components", "CaptchaChallenge.tsx"), "utf8");
    expect(bookingForm).toContain("useRef<CaptchaChallengeHandle | null>(null)");
    expect(bookingForm).toContain("if (siteKey && !form.turnstileToken)");
    expect(bookingForm).toContain("captchaRef.current?.reset(");
    expect(captcha).toContain("onExpire={() => reset(");
    expect(captcha).toContain('setMessage("The spam-protection check could not finish. Use Retry');
    expect(bookingForm).toContain("busy || Boolean(siteKey && !form.turnstileToken)");
  });
});

describe("staff entry validation", () => {
  it("accepts non-repeating, weekly, and monthly recurrence rules under Zod 4", () => {
    const base = { entryType: "event" as const, event: { groupName: "Adoption Event", category: "Rescue Organization" as const }, startDate: "2026-08-07", startTime: "14:00", durationMinutes: 240 };
    expect(manualEntrySchema.parse({ ...base, recurrence: { frequency: "none" } }).recurrence.frequency).toBe("none");
    expect(manualEntrySchema.parse({ ...base, recurrence: { frequency: "weekly", interval: 1, weekdays: [5], end: { type: "count", count: 4 } } }).recurrence.frequency).toBe("weekly");
    expect(manualEntrySchema.parse({ ...base, recurrence: { frequency: "monthly", interval: 1, mode: "day_of_month", dayOfMonth: 7, end: { type: "count", count: 2 } } }).recurrence.frequency).toBe("monthly");
  });
});

describe("customer reservation editing contract", () => {
  const details = {
    action: "update_details" as const,
    groupName: "  Tomorrow's Tails  ",
    category: "Rescue Organization" as const,
    contactName: "  Test User  ",
    phone: " 269-555-0100 ",
    privateNotes: "  Please call on arrival. ",
  };

  it("normalizes editable details and permits clearing optional fields", () => {
    expect(manageActionSchema.parse(details)).toEqual({
      ...details,
      groupName: "Tomorrow's Tails",
      contactName: "Test User",
      phone: "269-555-0100",
      privateNotes: "Please call on arrival.",
    });
    expect(manageActionSchema.parse({ ...details, phone: "", privateNotes: "" })).toMatchObject({ phone: undefined, privateNotes: undefined });
  });

  it("rejects invalid details and attempts to change locked or scheduling fields", () => {
    expect(manageActionSchema.safeParse({ ...details, category: "Not a category" }).success).toBe(false);
    expect(manageActionSchema.safeParse({ ...details, groupName: "x" }).success).toBe(false);
    expect(manageActionSchema.safeParse({ ...details, privateNotes: "x".repeat(1001) }).success).toBe(false);
    expect(manageActionSchema.safeParse({ ...details, email: "replacement@example.com" }).success).toBe(false);
    expect(manageActionSchema.safeParse({ ...details, start: "2026-08-09T18:00:00.000Z" }).success).toBe(false);
  });
});
