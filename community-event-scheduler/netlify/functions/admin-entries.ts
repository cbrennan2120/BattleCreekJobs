import type { Config } from "@netlify/functions";
import { requireAdmin } from "./_shared/admin-auth";
import { createManualEntry } from "./_shared/admin-entry-service";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { sendManualEntrySummary } from "./_shared/mailer";
import { manualEntrySchema } from "./_shared/validation";

export default async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    await requireAdmin(request, true);
    const draft = manualEntrySchema.parse(await readJson(request));
    const result = await createManualEntry(draft);
    let notificationSent: boolean | null = null;
    if (draft.entryType === "event" && draft.event.email && result.created.length) {
      notificationSent = true;
      await sendManualEntrySummary({
        email: draft.event.email,
        groupName: draft.event.groupName,
        action: "created",
        dates: result.created.map((item) => `${item.date} at ${item.time}`),
        skipped: result.skipped.length,
      }).catch((error) => { notificationSent = false; console.error(error); });
    }
    return json({ ...result, notificationSent }, { status: 201 });
  } catch (error) { return handleError(error); }
};

export const config: Config = { path: "/api/admin/entries" };
