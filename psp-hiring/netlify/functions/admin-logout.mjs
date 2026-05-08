import { clearSessionCookie, jsonResponse } from "./_lib/hiring-core.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  return jsonResponse({ authenticated: false }, {
    headers: {
      "Set-Cookie": clearSessionCookie(request)
    }
  });
};

export const config = {
  path: "/api/admin/logout"
};
