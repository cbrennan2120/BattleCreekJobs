import type { Config } from "@netlify/functions";
import { cleanupExpired } from "./_shared/cleanup";

export default async () => {
  const expired = await cleanupExpired();
  console.info(`Expired ${expired} unverified booking holds.`);
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: "*/5 * * * *" };
