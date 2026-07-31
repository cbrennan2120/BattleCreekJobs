import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { auditLog } from "../../db/schema";
import { requireAdmin } from "./_shared/admin-auth";
import { handleError, json, methodNotAllowed } from "./_shared/http";

export default async (request: Request) => {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    await requireAdmin(request);
    const rows = await getDb().select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(250);
    return json({ audit: rows });
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/admin/audit" };
