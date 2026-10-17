import { errorResponse, jsonResponse, saveApplicantLevel2Data, sendStoreNotificationEmail } from "./_lib/hiring-core.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const { applicantId, fullName, email, level2 } = body || {};
  if (!level2) {
    return errorResponse("Missing level2 data in request payload.", 400);
  }

  try {
    const saved = await saveApplicantLevel2Data(applicantId, {
      ...level2,
      fullName: fullName || level2.applicantSignature || "",
      email: email || ""
    });

    // Dispatch automated store email to psp0212@petsuppliesplus.com
    try {
      await sendStoreNotificationEmail({
        type: "level2",
        applicant: {
          id: saved.id,
          fullName: fullName || level2.applicantSignature || "Applicant",
          email: email || "",
          level2
        }
      });
    } catch (notifErr) {
      console.warn("Store notification warning:", notifErr);
    }

    return jsonResponse({
      received: true,
      submissionId: saved.id,
      stage: "full_completed"
    });
  } catch (error) {
    return errorResponse("Unable to save Step 2 application data.", 502, { details: String(error) });
  }
};

export const config = {
  path: "/api/level2"
};
