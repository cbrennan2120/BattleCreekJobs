import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalBooking = {
    id: "11111111-1111-4111-8111-111111111111",
    resourceId: "battle-creek-event-space",
    groupName: "Tomorrow's Tails",
    category: "Rescue Organization",
    contactName: "Test User",
    email: "test@example.com",
    phone: "269-555-0100",
    privateNotes: "Original note",
    status: "confirmed",
    source: "public",
    seriesId: null,
    occurrenceKey: null,
    isException: false,
    startsAt: new Date("2026-08-08T18:00:00.000Z"),
    endsAt: new Date("2026-08-08T21:00:00.000Z"),
    manageTokenHash: "hashed-token",
    expiresAt: null,
    confirmedAt: new Date("2026-08-01T15:00:00.000Z"),
    cancelledAt: null,
    createdAt: new Date("2026-08-01T14:00:00.000Z"),
    updatedAt: new Date("2026-08-01T15:00:00.000Z"),
  };
  const state: {
    selectedBooking: typeof originalBooking;
    updateValues?: Record<string, unknown>;
    auditValues?: Record<string, unknown>;
  } = { selectedBooking: { ...originalBooking } };
  const returning = vi.fn(async () => [{ ...state.selectedBooking, ...state.updateValues }]);
  const transaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback({
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        state.updateValues = values;
        return { where: vi.fn(() => ({ returning })) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        state.auditValues = values;
        return Promise.resolve();
      }),
    })),
  }));
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [state.selectedBooking]) })),
      })),
    })),
    transaction,
  };
  return { originalBooking, state, returning, transaction, db, sendChanged: vi.fn(async () => undefined) };
});

vi.mock("../db", () => ({ getDb: () => mocks.db }));
vi.mock("../netlify/functions/_shared/security", () => ({ secretHash: () => "hashed-token" }));
vi.mock("../netlify/functions/_shared/mailer", () => ({ sendChanged: mocks.sendChanged }));

import manageBooking from "../netlify/functions/manage-booking";

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/manage/private-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: { token: "a".repeat(43) } } as never;

describe("customer reservation details API", () => {
  beforeEach(() => {
    mocks.state.selectedBooking = { ...mocks.originalBooking };
    mocks.state.updateValues = undefined;
    mocks.state.auditValues = undefined;
    vi.clearAllMocks();
  });

  it("updates only editable columns and records the changed field names", async () => {
    const response = await manageBooking(request({
      action: "update_details",
      groupName: "Updated Adoption Event",
      category: "Community Event",
      contactName: "Updated Contact",
      phone: "",
      privateNotes: "Updated note",
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.state.updateValues).toMatchObject({
      groupName: "Updated Adoption Event",
      category: "Community Event",
      contactName: "Updated Contact",
      phone: null,
      privateNotes: "Updated note",
    });
    expect(mocks.state.updateValues).not.toHaveProperty("email");
    expect(mocks.state.updateValues).not.toHaveProperty("startsAt");
    expect(mocks.state.updateValues).not.toHaveProperty("endsAt");
    expect(mocks.state.auditValues).toMatchObject({ action: "booking_details_updated", metadata: { fields: ["event name", "category", "contact name", "phone", "private notes"] } });
    expect(mocks.sendChanged).toHaveBeenCalledWith("test@example.com", "Updated Adoption Event", expect.stringContaining("event name"));
    await expect(response.json()).resolves.toMatchObject({
      groupName: "Updated Adoption Event",
      email: "test@example.com",
      start: "2026-08-08T18:00:00.000Z",
      end: "2026-08-08T21:00:00.000Z",
    });
  });

  it("rejects email or schedule changes before writing", async () => {
    for (const lockedField of [
      { email: "replacement@example.com" },
      { start: "2026-08-09T18:00:00.000Z" },
    ]) {
      const response = await manageBooking(request({
        action: "update_details",
        groupName: "Tomorrow's Tails",
        category: "Rescue Organization",
        contactName: "Test User",
        ...lockedField,
      }), context);
      expect(response.status).toBe(400);
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid links and cancelled reservations", async () => {
    const invalidLink = await manageBooking(request({ action: "cancel" }), { params: { token: "short" } } as never);
    expect(invalidLink.status).toBe(404);

    mocks.state.selectedBooking = { ...mocks.originalBooking, status: "cancelled" };
    const cancelled = await manageBooking(request({
      action: "update_details",
      groupName: "Tomorrow's Tails",
      category: "Rescue Organization",
      contactName: "Test User",
    }), context);
    expect(cancelled.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
