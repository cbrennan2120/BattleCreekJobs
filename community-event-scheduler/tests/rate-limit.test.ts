import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: { rows: Array<Array<{ count: number }>> } = { rows: [] };
  const returning = vi.fn(async () => state.rows.shift() ?? []);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const db = { insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate })) })) };
  return { state, returning, onConflictDoUpdate, db };
});

vi.mock("../db", () => ({ getDb: () => mocks.db }));
vi.mock("../netlify/functions/_shared/env", () => ({
  env: () => "test-secret",
  requiredEnv: () => "test-secret",
  isNetlifyRuntime: () => false,
}));

import { enforceRateLimit } from "../netlify/functions/_shared/security";

describe("database rate limiter", () => {
  beforeEach(() => {
    mocks.state.rows = [];
    vi.clearAllMocks();
  });

  it("uses a conditional conflict update and treats an exhausted row as rate limited", async () => {
    mocks.state.rows = [[]];
    await expect(enforceRateLimit("booking_verify_ip", "203.0.113.42", 30, 15)).rejects.toMatchObject({ status: 429 });
    const update = mocks.onConflictDoUpdate.mock.calls[0][0];
    expect(update).toHaveProperty("setWhere");
    expect(update).toHaveProperty("set");
  });

  it("allows a request while PostgreSQL returns an updated counter row", async () => {
    mocks.state.rows = [[{ count: 30 }]];
    await expect(enforceRateLimit("booking_verify_ip", "203.0.113.42", 30, 15)).resolves.toBeUndefined();
  });
});
