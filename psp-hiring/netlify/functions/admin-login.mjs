import { createSessionCookie, errorResponse, getManagerAccessCode, jsonResponse } from "./_lib/hiring-core.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const configuredCode = getManagerAccessCode();
  if (!configuredCode) {
    return errorResponse("Manager access code is not configured.", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid login payload.", 400);
  }

  if ((body?.code || "").trim() !== configuredCode) {
    return errorResponse("Incorrect manager code.", 401);
  }

  return jsonResponse({ authenticated: true }, {
    headers: {
      "Set-Cookie": createSessionCookie(request)
    }
  });
};

export const config = {
  path: "/api/admin/login"
};
