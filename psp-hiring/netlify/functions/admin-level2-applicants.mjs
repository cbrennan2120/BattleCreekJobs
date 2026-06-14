import {
  errorResponse,
  jsonResponse,
  requireAdminSession,
  buildApiHeaders,
  getSiteId,
  parseSubmissionPayload
} from "./_lib/hiring-core.mjs";

const LEVEL2_FORM_NAME = "level2-application";

async function fetchLevel2FormDefinition() {
  const siteId = getSiteId();
  if (!siteId) throw new Error("Missing SITE_ID for Netlify API access.");

  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
    headers: buildApiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Unable to load site forms (${response.status}).`);
  }

  const forms = await response.json();
  const form = forms.find((entry) => entry.name === LEVEL2_FORM_NAME);
  return form; // May be undefined if form doesn't exist yet
}

async function fetchLevel2Submissions() {
  const form = await fetchLevel2FormDefinition();
  if (!form) return []; // Form might not be created until first submission

  const response = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
    headers: buildApiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Unable to load form submissions (${response.status}).`);
  }
  return await response.json();
}

export default async (request) => {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  if (request.method === "GET") {
    try {
      const submissions = await fetchLevel2Submissions();
      
      const applicants = submissions.map(sub => {
        let payload = parseSubmissionPayload(sub);
        
        // If the payload contains level2Payload as a string, parse it
        if (payload.level2Payload && typeof payload.level2Payload === "string") {
          try {
            const parsedLevel2 = JSON.parse(payload.level2Payload);
            payload = { ...payload, ...parsedLevel2 };
          } catch (e) {
            console.error("Failed to parse level2Payload", e);
          }
        }

        return {
          id: sub.id,
          created_at: sub.created_at,
          fullName: payload.fullName || sub.name || sub.data?.fullName || "Unknown Applicant",
          email: payload.email || sub.email || sub.data?.email || "",
          phone: payload.phone || sub.data?.phone || "",
          ...payload
        };
      });

      // Sort newest first
      applicants.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return jsonResponse({ applicants });
    } catch (error) {
      return errorResponse("Unable to load Level 2 applicants.", 502, { details: String(error) });
    }
  }

  return errorResponse("Method not allowed", 405);
};

export const config = {
  path: "/api/admin/level2-applicants"
};
