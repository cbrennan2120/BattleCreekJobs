import { getConnectionString } from "@netlify/database";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "../netlify/functions/_shared/env";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (database) return database;
  let connectionString = env("DATABASE_URL") || env("NETLIFY_DB_URL");
  if (!connectionString) {
    try { connectionString = getConnectionString(); } catch { /* handled below */ }
  }
  if (!connectionString) throw new Error("Database is not configured. Connect Netlify Database or set DATABASE_URL.");
  database = drizzle(connectionString, { schema });
  return database;
}
