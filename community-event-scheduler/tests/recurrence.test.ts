import { describe, expect, it } from "vitest";
import { generateRecurrence } from "../netlify/functions/_shared/recurrence";

describe("staff recurrence generation", () => {
  it("generates daily occurrences by interval and count", () => {
    const result = generateRecurrence({ startDate: "2026-08-01", startTime: "09:00", durationMinutes: 30, recurrence: { frequency: "daily", interval: 2, end: { type: "count", count: 4 } } });
    expect(result.occurrences.map((item) => item.localDate)).toEqual(["2026-08-01", "2026-08-03", "2026-08-05", "2026-08-07"]);
  });

  it("supports interval weekly rules with multiple weekdays", () => {
    const result = generateRecurrence({ startDate: "2026-08-03", startTime: "18:00", durationMinutes: 60, recurrence: { frequency: "weekly", interval: 2, weekdays: [1, 3], end: { type: "count", count: 5 } } });
    expect(result.occurrences.map((item) => item.localDate)).toEqual(["2026-08-03", "2026-08-05", "2026-08-17", "2026-08-19", "2026-08-31"]);
  });

  it("skips missing day-of-month dates instead of moving them", () => {
    const result = generateRecurrence({ startDate: "2026-01-31", startTime: "10:00", durationMinutes: 30, recurrence: { frequency: "monthly", interval: 1, mode: "day_of_month", dayOfMonth: 31, end: { type: "count", count: 3 } } });
    expect(result.occurrences.map((item) => item.localDate)).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    expect(result.omitted.map((item) => item.localDate)).toEqual(["2026-02-31", "2026-04-31"]);
  });

  it("generates ordinal weekdays including last weekday", () => {
    const secondTuesday = generateRecurrence({ startDate: "2026-01-01", startTime: "12:00", durationMinutes: 30, recurrence: { frequency: "monthly", interval: 1, mode: "ordinal_weekday", ordinal: 2, weekday: 2, end: { type: "count", count: 3 } } });
    expect(secondTuesday.occurrences.map((item) => item.localDate)).toEqual(["2026-01-13", "2026-02-10", "2026-03-10"]);
    const lastFriday = generateRecurrence({ startDate: "2026-01-01", startTime: "12:00", durationMinutes: 30, recurrence: { frequency: "monthly", interval: 1, mode: "ordinal_weekday", ordinal: -1, weekday: 5, end: { type: "count", count: 2 } } });
    expect(lastFriday.occurrences.map((item) => item.localDate)).toEqual(["2026-01-30", "2026-02-27"]);
  });

  it("preserves Detroit wall time across daylight-saving changes", () => {
    const result = generateRecurrence({ startDate: "2026-03-01", startTime: "09:30", durationMinutes: 30, recurrence: { frequency: "weekly", interval: 1, weekdays: [7], end: { type: "count", count: 3 } } });
    expect(result.occurrences.map((item) => item.localTime)).toEqual(["09:30", "09:30", "09:30"]);
    expect(result.occurrences.map((item) => item.start)).toEqual(["2026-03-01T14:30:00.000Z", "2026-03-08T13:30:00.000Z", "2026-03-15T13:30:00.000Z"]);
  });

  it("handles leap-day monthly rules and enforces the 200-date limit", () => {
    const leap = generateRecurrence({ startDate: "2028-02-29", startTime: "09:00", durationMinutes: 30, recurrence: { frequency: "monthly", interval: 12, mode: "day_of_month", dayOfMonth: 29, end: { type: "until", date: "2030-02-28" } } });
    expect(leap.occurrences.map((item) => item.localDate)).toEqual(["2028-02-29"]);
    expect(leap.omitted).toHaveLength(2);
    expect(() => generateRecurrence({ startDate: "2026-01-01", startTime: "09:00", durationMinutes: 30, recurrence: { frequency: "daily", interval: 1, end: { type: "count", count: 201 } } })).toThrow(/200/);
  });
});
