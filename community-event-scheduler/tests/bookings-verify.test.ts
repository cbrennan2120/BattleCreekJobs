import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../netlify/functions/_shared/errors";

const mocks = vi.hoisted(() => {
  const state: { selections: unknown[][]; audit?: Record<string, unknown> } = { selections: [] };
  const limit = vi.fn(async () => state.selections.shift() ?? []);
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) }));
  const transaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback({
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: "booking-id" }]),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn((values: Record<string, unknown>) => { state.audit = values; return Promise.resolve(); }) })),
  }));
  return {
    state,
    db: { select, transaction },
    enforceRateLimit: vi.fn(async () => undefined),
    sendConfirmation: vi.fn(async () => undefined),
  };
});

vi.mock("../db", () => ({ getDb: () => mocks.db }));
vi.mock("../netlify/functions/_shared/security", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  randomToken: () => "final-token",
  safeHashMatch: () => true,
  secretHash: () => "hashed-final-token",
}));
vi.mock("../netlify/functions/_shared/mailer", () => ({ sendConfirmation: mocks.sendConfirmation }));
vi.mock("../netlify/functions/_shared/env", () => ({ env: () => "https://example.test" }));

import verifyBooking, { config } from "../netlify/functions/bookings-verify";

const challengeId = "11111111-1111-4111-8111-111111111111";
const context = { ip: "2001:db8::7" } as never;

function request(body: unknown) {
  return new Request("https://example.test/api/bookings/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("booking verification abuse controls", () => {
  beforeEach(() => {
    mocks.state.selections = [];
    mocks.state.audit = undefined;
    vi.clearAllMocks();
  });

  it("rejects malformed and oversized bodies before either limiter or the database", async () => {
    const malformed = await verifyBooking(request({ challengeId, code: "123456", unexpected: true }), context);
    expect(malformed.status).toBe(400);

    const oversized = await verifyBooking(request({ challengeId, code: "123456", padding: "x".repeat(1_100) }), context);
    expect(oversized.status).toBe(413);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("enforces the trusted IP before the challenge key and stops when the IP is exhausted", async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(new HttpError(429, "Too many attempts."));
    const response = await verifyBooking(request({ challengeId, code: "123456" }), context);
    expect(response.status).toBe(429);
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith("booking_verify_ip", "2001:db8::7", 30, 15);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("then enforces the challenge limiter before querying the booking", async () => {
    const response = await verifyBooking(request({ challengeId, code: "123456" }), context);
    expect(response.status).toBe(404);
    expect(mocks.enforceRateLimit.mock.calls).toEqual([
      ["booking_verify_ip", "2001:db8::7", 30, 15],
      ["booking_verify_challenge", challengeId, 8, 15],
    ]);
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it("preserves successful verification and records the trusted IPv6 address", async () => {
    mocks.state.selections = [[{
      id: challengeId,
      bookingId: "booking-id",
      codeHash: "hash",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    }], [{
      id: "booking-id",
      status: "pending_verification",
      email: "customer@example.com",
      groupName: "Adoption Event",
      category: "Rescue Organization",
      startsAt: new Date("2026-08-08T18:00:00.000Z"),
      endsAt: new Date("2026-08-08T21:00:00.000Z"),
    }]];

    const response = await verifyBooking(request({ challengeId, code: "123456" }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "confirmed", manageUrl: "https://example.test/manage/final-token" });
    expect(mocks.state.audit).toMatchObject({ action: "booking_confirmed", ipAddress: "2001:db8::7" });
    expect(mocks.sendConfirmation).toHaveBeenCalledOnce();
  });

  it("configures the Netlify edge limit at 20 requests per minute per site and IP", () => {
    expect(config.rateLimit).toEqual({ action: "rate_limit", aggregateBy: ["ip", "domain"], windowLimit: 20, windowSize: 60 });
  });
});
