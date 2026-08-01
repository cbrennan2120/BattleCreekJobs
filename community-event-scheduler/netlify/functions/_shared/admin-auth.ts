import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { adminSessions, auditLog } from "../../../db/schema";
import { env, isNetlifyRuntime, requiredEnv } from "./env";
import { HttpError } from "./errors";
import { randomToken, safeHashMatch, secretHash } from "./security";

export const ADMIN_COOKIE = "psp_admin_session";

function cookieValue(request: Request, name: string): string | undefined {
  const source = request.headers.get("cookie") || "";
  return source.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function createAdminSession(passcode: string, ipAddress: string): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const configuredHash = requiredEnv("ADMIN_PASSCODE_HASH");
  if (!(await bcrypt.compare(passcode, configuredHash))) throw new HttpError(401, "The staff passcode is not correct.");
  const token = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + 8 * 3_600_000);
  const db = getDb();
  await db.insert(adminSessions).values({ tokenHash: secretHash(token), csrfTokenHash: secretHash(csrfToken), expiresAt });
  await db.insert(auditLog).values({ actorType: "admin", actorLabel: "Shared staff", ipAddress, action: "admin_login", entityType: "session" });
  return { token, csrfToken, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}${isNetlifyRuntime() ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isNetlifyRuntime() ? "; Secure" : ""}`;
}

export async function requireAdmin(request: Request, requireCsrf = false) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token) throw new HttpError(401, "Staff sign-in is required.");
  const db = getDb();
  const [session] = await db.select().from(adminSessions).where(and(eq(adminSessions.tokenHash, secretHash(token)), gt(adminSessions.expiresAt, new Date()))).limit(1);
  if (!session) throw new HttpError(401, "Your staff session has expired.");
  if (requireCsrf) {
    const csrf = request.headers.get("x-csrf-token");
    if (!csrf || !safeHashMatch(csrf, session.csrfTokenHash)) throw new HttpError(403, "The security token is missing or expired.");
  }
  await db.update(adminSessions).set({ lastSeenAt: new Date() }).where(eq(adminSessions.id, session.id));
  return session;
}

export async function deleteAdminSession(request: Request): Promise<void> {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (token) await getDb().delete(adminSessions).where(eq(adminSessions.tokenHash, secretHash(token)));
}
