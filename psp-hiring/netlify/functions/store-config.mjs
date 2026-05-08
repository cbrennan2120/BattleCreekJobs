import {
  errorResponse,
  getEffectiveStoreConfig,
  jsonResponse,
  normalizeStoreConfig,
  requireAdminSession,
  saveEffectiveStoreConfig
} from "./_lib/hiring-core.mjs";

export default async (request) => {
  const pathname = new URL(request.url).pathname;
  const isAdminPath = pathname.includes("/api/admin/");

  if (request.method === "GET") {
    try {
      const config = await getEffectiveStoreConfig();
      return jsonResponse({ config });
    } catch (error) {
      return errorResponse("Unable to load store configuration.", 502, { details: String(error) });
    }
  }

  if (request.method === "PUT" && isAdminPath) {
    const unauthorized = await requireAdminSession(request);
    if (unauthorized) return unauthorized;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid store configuration payload.", 400);
    }

    try {
      const nextConfig = normalizeStoreConfig(body?.config || {});
      const saved = await saveEffectiveStoreConfig(nextConfig);
      return jsonResponse({ config: saved });
    } catch (error) {
      return errorResponse("Unable to save store configuration.", 502, { details: String(error) });
    }
  }

  return errorResponse("Method not allowed", 405);
};

export const config = {
  path: ["/api/store-config", "/api/admin/store-config"]
};
