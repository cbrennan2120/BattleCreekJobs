import { errorResponse, jsonResponse, saveApplicantSubmission } from "./_lib/hiring-core.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let applicant;
  try {
    applicant = await request.json();
  } catch {
    return errorResponse("Invalid applicant payload.", 400);
  }

  if (!applicant?.fullName || !applicant?.email || !applicant?.position) {
    return errorResponse("Applicant payload is missing required fields.", 400);
  }

  try {
    const saved = await saveApplicantSubmission(applicant);
    return jsonResponse({ received: true, submissionId: saved.id });
  } catch (error) {
    return errorResponse("Unable to save applicant intake.", 502, { details: String(error) });
  }
};

export const config = {
  path: "/api/apply"
};
