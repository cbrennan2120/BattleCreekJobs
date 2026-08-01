import { ZodError } from "zod";
import { HttpError } from "./errors";

const baseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), { ...init, headers: { ...baseHeaders, ...init.headers } });
}

export function methodNotAllowed(methods: string[]): Response {
  return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: methods.join(", ") } });
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return json({ error: "Please check the highlighted information.", details: error.flatten() }, { status: 400 });
  console.error(error);
  return json({ error: "We could not complete that request. Please try again." }, { status: 500 });
}

export async function readJson(request: Request, maxBytes?: number): Promise<unknown> {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new HttpError(415, "This endpoint accepts JSON only.");
  if (maxBytes === undefined) {
    try { return await request.json(); } catch { throw new HttpError(400, "The request body is not valid JSON."); }
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new HttpError(413, "The request body is too large.");
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > maxBytes) throw new HttpError(413, "The request body is too large.");
  try { return JSON.parse(source); } catch { throw new HttpError(400, "The request body is not valid JSON."); }
}
