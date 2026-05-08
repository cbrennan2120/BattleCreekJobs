import {
  deleteApplicantSubmission,
  deleteReviewRecord,
  errorResponse,
  getEffectiveStoreConfig,
  jsonResponse,
  listApplicantSubmissions,
  listReviewRecords,
  normalizeSubmission,
  requireAdminSession,
  saveReviewRecord,
  sortApplicants
} from "./_lib/hiring-core.mjs";

function getSubmissionIdFromRequest(request) {
  const pathname = new URL(request.url).pathname;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 3 ? segments[3] : null;
}

export default async (request) => {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  if (request.method === "GET") {
    try {
      const storeConfig = await getEffectiveStoreConfig();
      const submissions = await listApplicantSubmissions();
      let reviewLookup = new Map();
      let reviewStorageReachable = true;

      try {
        reviewLookup = await listReviewRecords();
      } catch {
        reviewStorageReachable = false;
      }

      const merged = await Promise.all(submissions.map(async (submission) => {
        const review = reviewLookup.get(submission.id) || null;
        return normalizeSubmission(submission, review, storeConfig);
      }));
      return jsonResponse({ applicants: sortApplicants(merged), reviewStorageReachable });
    } catch (error) {
      return errorResponse("Unable to load applicants from shared intake.", 502, { details: String(error) });
    }
  }

  if (request.method === "PATCH") {
    const submissionId = getSubmissionIdFromRequest(request);
    if (!submissionId) {
      return errorResponse("Missing applicant id.", 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid update payload.", 400);
    }

    const patch = {
      stage: body?.stage,
      managerNote: body?.managerNote,
      lastAction: body?.lastAction
    };

    try {
      const updated = await saveReviewRecord(submissionId, patch);
      return jsonResponse({ review: updated });
    } catch (error) {
      return errorResponse("Unable to save applicant review state.", 502, { details: String(error) });
    }
  }

  if (request.method === "DELETE") {
    const submissionId = getSubmissionIdFromRequest(request);
    if (!submissionId) {
      return errorResponse("Missing applicant id.", 400);
    }

    try {
      await deleteApplicantSubmission(submissionId);
      await deleteReviewRecord(submissionId);
      return jsonResponse({ deleted: true, submissionId });
    } catch (error) {
      return errorResponse("Unable to delete applicant.", 502, { details: String(error) });
    }
  }

  return errorResponse("Method not allowed", 405);
};

export const config = {
  path: ["/api/admin/applicants", "/api/admin/applicants/*"]
};
