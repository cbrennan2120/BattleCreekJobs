import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import type { BookingRow, WeeklyHoursRow } from "../db/schema";
import { generateAvailability, slotStarts, validateBookingWindow } from "../netlify/functions/_shared/scheduling";

const hours = Array.from({ length: 7 }, (_, index) => ({
  id: crypto.randomUUID(),
  dayOfWeek: index + 1,
  opensAt: index === 6 ? "10:00" : "09:00",
  closesAt: index === 6 ? "18:00" : "21:00",
  isClosed: false,
  updatedAt: new Date(),
})) satisfies WeeklyHoursRow[];

function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: crypto.randomUUID(),
    resourceId: "battle-creek-event-space",
    groupName: "Battle Creek Rescue",
    category: "Rescue Organization",
    contactName: "Private Person",
    email: "private@example.com",
    phone: "269-555-0100",
    privateNotes: "Never public",
    status: "confirmed",
    startsAt: new Date("2026-08-10T17:00:00.000Z"),
    endsAt: new Date("2026-08-10T18:00:00.000Z"),
    manageTokenHash: "secret",
    expiresAt: null,
    confirmedAt: new Date(),
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("slot policy", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");

  it("creates consecutive 30-minute starts", () => {
    expect(slotStarts(new Date("2026-08-10T13:00:00Z"), new Date("2026-08-10T15:00:00Z"))).toHaveLength(4);
  });

  it("accepts a valid four-hour reservation inside store hours", () => {
    const result = validateBookingWindow({ start: "2026-08-10T13:00:00.000Z", end: "2026-08-10T17:00:00.000Z" }, hours, [], now);
    expect(result.slots).toHaveLength(8);
  });

  it("rejects durations longer than four hours", () => {
    expect(() => validateBookingWindow({ start: "2026-08-10T13:00:00.000Z", end: "2026-08-10T17:30:00.000Z" }, hours, [], now)).toThrow(/four hours/);
  });

  it("rejects less than 24 hours notice and more than 90 days", () => {
    expect(() => validateBookingWindow({ start: "2026-08-01T11:00:00.000Z", end: "2026-08-01T12:00:00.000Z" }, hours, [], now)).toThrow(/24 hours/);
    expect(() => validateBookingWindow({ start: "2026-11-15T15:00:00.000Z", end: "2026-11-15T16:00:00.000Z" }, hours, [], now)).toThrow(/90 days/);
  });

  it("rejects a reservation that overlaps a blackout", () => {
    expect(() => validateBookingWindow(
      { start: "2026-08-10T13:00:00.000Z", end: "2026-08-10T15:00:00.000Z" },
      hours,
      [{ startsAt: new Date("2026-08-10T14:00:00.000Z"), endsAt: new Date("2026-08-10T14:30:00.000Z") }],
      now,
    )).toThrow(/blocked/);
  });
});

describe("public availability", () => {
  it("shows group/category but strips every private contact field", () => {
    const result = generateAvailability("2026-08-10", hours, [], [booking()]);
    const payload = JSON.stringify(result);
    expect(payload).toContain("Battle Creek Rescue");
    expect(payload).toContain("Rescue Organization");
    expect(payload).not.toContain("Private Person");
    expect(payload).not.toContain("private@example.com");
    expect(payload).not.toContain("269-555-0100");
    expect(payload).not.toContain("Never public");
    expect(payload).not.toContain("manageTokenHash");
  });

  it("does not reveal a pending group name", () => {
    const payload = JSON.stringify(generateAvailability("2026-08-10", hours, [], [booking({ status: "pending_verification" })]));
    expect(payload).toContain("pending");
    expect(payload).not.toContain("Battle Creek Rescue");
  });

  it("generates the Sunday schedule across the fall DST transition", () => {
    const result = generateAvailability("2026-10-26", hours, [], []);
    const sunday = result.filter((slot) => DateTime.fromISO(slot.start).setZone("America/Detroit").toISODate() === "2026-11-01");
    expect(sunday).toHaveLength(16);
  });
});
