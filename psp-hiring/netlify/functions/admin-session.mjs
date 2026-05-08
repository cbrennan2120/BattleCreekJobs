import { jsonResponse, verifySession } from "./_lib/hiring-core.mjs";

export default async (request) => {
  return jsonResponse({ authenticated: verifySession(request) });
};

export const config = {
  path: "/api/admin/session"
};
