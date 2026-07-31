import type { Config, Context } from "@netlify/functions";
import { z } from "zod";
import { clearSessionCookie, createAdminSession, deleteAdminSession, requireAdmin, sessionCookie } from "./_shared/admin-auth";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { enforceRateLimit, verifyTurnstile } from "./_shared/security";

const loginSchema = z.object({ passcode: z.string().min(1).max(200), turnstileToken: z.string().optional() });

export default async (request: Request, context: Context) => {
  try {
    if (request.method === "POST") {
      const input = loginSchema.parse(await readJson(request));
      await Promise.all([verifyTurnstile(input.turnstileToken, context.ip), enforceRateLimit("admin_login", context.ip, 8, 30)]);
      const session = await createAdminSession(input.passcode);
      return json({ csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
    }
    if (request.method === "DELETE") {
      await requireAdmin(request, true);
      await deleteAdminSession(request);
      return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
    }
    return methodNotAllowed(["POST", "DELETE"]);
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/admin/session" };
