import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { rateLimits } from "../../../db/schema";
import { env, isNetlifyRuntime, requiredEnv } from "./env";
import { HttpError } from "./errors";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function secretHash(value: string): string {
  return createHmac("sha256", requiredEnv("SESSION_SECRET")).update(value).digest("hex");
}

export function safeHashMatch(value: string, expected: string): boolean {
  const actual = Buffer.from(secretHash(value), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<void> {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret) {
    if (isNetlifyRuntime()) throw new HttpError(503, "Spam protection is not configured yet.");
    return;
  }
  if (!token) throw new HttpError(400, "Please complete the spam-protection check.");
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const result = await response.json() as { success?: boolean };
  if (!result.success) throw new HttpError(400, "The spam-protection check expired. Please try it again.");
}

export async function enforceRateLimit(action: string, rawKey: string, limit: number, windowMinutes: number): Promise<void> {
  const db = getDb();
  const now = new Date();
  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const keyHash = secretHash(`${action}:${rawKey.toLowerCase()}`);
  const [row] = await db.insert(rateLimits).values({ action, keyHash, windowStart, expiresAt, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.action, rateLimits.keyHash, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    }).returning({ count: rateLimits.count });
  if (row.count > limit) throw new HttpError(429, "Too many attempts. Please wait and try again.");
}
