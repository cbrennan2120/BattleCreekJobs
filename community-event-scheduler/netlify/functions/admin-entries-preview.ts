import type { Config } from "@netlify/functions";
import { requireAdmin } from "./_shared/admin-auth";
import { entrySelectionForPreview, previewManualEntry } from "./_shared/admin-entry-service";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { manualEntrySchema } from "./_shared/validation";
import { HttpError } from "./_shared/errors";

export default async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    await requireAdmin(request, true);
    const body = await readJson(request);
    const wrapped = body && typeof body === "object" && "draft" in body ? body as { draft: unknown; editing?: { id?: unknown; scope?: unknown } } : null;
    const draft = manualEntrySchema.parse(wrapped ? wrapped.draft : body);
    let exclusions = {};
    if (wrapped?.editing) {
      const id = typeof wrapped.editing.id === "string" ? wrapped.editing.id : "";
      const scope = wrapped.editing.scope;
      if (!id || (scope !== "occurrence" && scope !== "following" && scope !== "series")) throw new HttpError(400, "Choose a valid entry and edit scope.");
      exclusions = await entrySelectionForPreview(id, scope);
    }
    const result = await previewManualEntry(draft, exclusions);
    return json({
      occurrences: [
        ...result.ready.map((item) => ({ ...item, status: "open" as const })),
        ...result.skipped.map((item) => ({ ...item, status: item.start ? "conflict" as const : "skipped" as const })),
      ].sort((a, b) => a.date.localeCompare(b.date)),
      openCount: result.ready.length,
      skippedCount: result.skipped.length,
    });
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/admin/entries/preview" };
