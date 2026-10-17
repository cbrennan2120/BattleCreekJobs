import crypto from "node:crypto";
import { getStore, getDeployStore } from "@netlify/blobs";

export const NETLIFY_FORM_NAME = "battle-creek-application";
export const COOKIE_NAME = "psp_admin_session";
export const LEGACY_DEFAULT_ADMIN_CODE = "battlecreek-manager";
export const SERVER_DEFAULT_MANAGER_CODE = "bcpets-hiring-4827-maple";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const REVIEW_STORE_NAME = "psp-hiring-admin";
export const APPLICANT_STORE_NAME = "psp-hiring-intake";
export const CONFIG_STORE_NAME = "psp-hiring-config";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHIFTS = [
  { id: "morning", label: "Day Shift", hours: "9a - 5p" },
  { id: "afternoon", label: "Mid Shift", hours: "11a - 7p" },
  { id: "evening", label: "Closing Shift", hours: "5p - 9p" }
];

export const DEFAULT_STORE_CONFIG = {
  name: "Pet Supplies Plus Battle Creek",
  legalName: "Battle Creek Pets LLC",
  location: "Battle Creek",
  payMin: 13.73,
  payMax: 13.73,
  minimumHoursNeeded: 12,
  maximumHoursOffered: 35,
  employmentType: "Part-time",
  requireSaturday: true,
  requireSunday: true,
  requireEvenings: false,
  preferEvenings: true,
  schedulingLink: "https://calendar.app.google/nijf5P59jCSbdGcX8",
  schedulingOwnerEmail: "cbrennan2120@gmail.com",
  notificationEmail: "psp0212@petsuppliesplus.com",
  interviewWindow: "Tuesdays and Fridays from 3:00 PM to 4:00 PM, 20-minute interviews with a 10-minute buffer",
  interviewLocation: "1791 W. Columbia Ave, Battle Creek, MI",
  senderName: "Chris Brennan",
  senderTitle: "Store Team Leader",
  inviteSubjectTemplate: "{{storeName}} interview invitation",
  inviteBodyTemplate: `Hi {{firstName}},

Thank you for applying to {{storeName}}. After reviewing your application, I would like to invite you to the next step in our hiring process.

Before booking, please confirm that you are still available for {{availabilityRequirement}} and comfortable with the starting pay rate of {{payRate}} per hour.

If that still works for you, please use the link below to choose an interview time:
{{schedulingLink}}

Interview location:
{{interviewLocation}}

Current interview window:
{{interviewWindow}}

If you have any questions before scheduling, feel free to reply.

Thank you,
{{senderName}}
{{senderTitle}}
{{storeName}}`,
  declineSubjectTemplate: "{{storeName}} application update",
  declineBodyTemplate: `Hi {{firstName}},

Thank you for taking the time to apply to {{storeName}}. We appreciate your interest in joining our team.

After reviewing your application, we are moving forward with candidates whose current availability and overall fit more closely match this opening.

We appreciate the time and effort you put into your application, and we wish you the best in your job search.

Thank you,
{{senderName}}
{{senderTitle}}
{{storeName}}`
};

export const STAGE_LABELS = {
  new: "New",
  full_completed: "Level 2 Completed",
  interview: "Interviewing",
  hold: "Hold",
  declined: "Declined",
  hired: "Hired"
};

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function errorResponse(message, status = 500, extras = {}) {
  return jsonResponse({ error: message, ...extras }, { status });
}

function readEnv(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name);
  if (netlifyValue) return netlifyValue;
  return process.env[name] || "";
}

export function getManagerAccessCode() {
  return readEnv("MANAGER_ACCESS_CODE") || SERVER_DEFAULT_MANAGER_CODE;
}

function getSessionSecret() {
  return readEnv("ADMIN_SESSION_SECRET") || `${getManagerAccessCode()}-session`;
}

export function createSessionCookie(request) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET or MANAGER_ACCESS_CODE.");

  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    scope: "admin"
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  const token = `${encoded}.${signature}`;
  const url = new URL(request.url);
  const secure = url.protocol === "https:";

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function verifySession(request) {
  const secret = getSessionSecret();
  if (!secret) return false;

  const token = parseCookies(request.headers.get("cookie") || "")[COOKIE_NAME];
  if (!token) return false;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload?.scope === "admin" && Number(payload?.exp || 0) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookies(raw) {
  return raw.split(";").reduce((cookies, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return cookies;
    cookies[name] = rest.join("=");
    return cookies;
  }, {});
}

export async function requireAdminSession(request) {
  if (!verifySession(request)) {
    return errorResponse("Unauthorized", 401);
  }
  return null;
}

export async function getReviewStore() {
  try {
    return getStore(REVIEW_STORE_NAME, { consistency: "strong" });
  } catch {
    return getDeployStore(REVIEW_STORE_NAME);
  }
}

export async function getApplicantStore() {
  try {
    return getStore(APPLICANT_STORE_NAME, { consistency: "strong" });
  } catch {
    return getDeployStore(APPLICANT_STORE_NAME);
  }
}

export async function getConfigStore() {
  try {
    return getStore(CONFIG_STORE_NAME, { consistency: "strong" });
  } catch {
    return getDeployStore(CONFIG_STORE_NAME);
  }
}

export async function listReviewRecords() {
  const store = await getReviewStore();
  const { blobs } = await store.list({ prefix: "reviews/" });
  const records = new Map();
  for (const blob of blobs) {
    const record = await store.get(blob.key, { type: "json" });
    if (record?.submissionId) {
      records.set(record.submissionId, record);
    }
  }
  return records;
}

export async function getReviewRecord(submissionId) {
  const store = await getReviewStore();
  return await store.get(`reviews/${submissionId}.json`, { type: "json" });
}

export async function deleteReviewRecord(submissionId) {
  const store = await getReviewStore();
  await store.delete(`reviews/${submissionId}.json`);
}

export async function saveReviewRecord(submissionId, patch) {
  const store = await getReviewStore();
  const existing = await getReviewRecord(submissionId);
  const next = {
    submissionId,
    stage: patch.stage ?? existing?.stage ?? "new",
    managerNote: patch.managerNote ?? existing?.managerNote ?? "",
    reviewedAt: new Date().toISOString(),
    reviewedBy: existing?.reviewedBy ?? "manager",
    lastAction: patch.lastAction ?? existing?.lastAction ?? null
  };
  await store.setJSON(`reviews/${submissionId}.json`, next);
  return next;
}

export async function listApplicantSubmissions() {
  const store = await getApplicantStore();
  const { blobs } = await store.list({ prefix: "submissions/" });
  const submissions = [];
  for (const blob of blobs) {
    const submission = await store.get(blob.key, { type: "json" });
    if (submission?.id) {
      submissions.push(submission);
    }
  }
  return submissions.sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
}

export async function saveApplicantSubmission(applicant) {
  const store = await getApplicantStore();
  const id = applicant?.id || crypto.randomUUID();
  const submittedAt = applicant?.submittedAt || new Date().toISOString();
  const record = {
    id,
    created_at: submittedAt,
    form_name: NETLIFY_FORM_NAME,
    body: JSON.stringify(applicant),
    data: {
      fullName: applicant?.fullName || "",
      email: applicant?.email || "",
      phone: applicant?.phone || "",
      city: applicant?.city || "",
      position: applicant?.position || "",
      hoursWanted: applicant?.hoursWanted || "",
      expectedPay: applicant?.expectedPay ?? "",
      minimumHoursNeeded: applicant?.minimumHoursNeeded ?? "",
      bucketLabel: applicant?.bucketLabel || "",
      submissionPayload: JSON.stringify(applicant)
    }
  };

  await store.setJSON(`submissions/${id}.json`, record);
  return record;
}

export async function deleteApplicantSubmission(submissionId) {
  const store = await getApplicantStore();
  await store.delete(`submissions/${submissionId}.json`);
}

export async function saveApplicantLevel2Data(applicantId, level2Data) {
  const store = await getApplicantStore();
  let record = null;

  if (applicantId) {
    try {
      record = await store.get(`submissions/${applicantId}.json`, { type: "json" });
    } catch {
      record = null;
    }
  }

  if (!record && level2Data.email) {
    const all = await listApplicantSubmissions();
    record = all.find((s) => {
      const p = parseSubmissionPayload(s);
      return (p.email || s.data?.email || "").toLowerCase() === level2Data.email.toLowerCase();
    });
  }

  const id = record?.id || applicantId || crypto.randomUUID();
  const existingPayload = record ? parseSubmissionPayload(record) : {};

  const updatedPayload = {
    ...existingPayload,
    id,
    fullName: existingPayload.fullName || level2Data.fullName || "Applicant",
    email: existingPayload.email || level2Data.email || "",
    phone: existingPayload.phone || level2Data.phone || "",
    level2: {
      ...level2Data,
      submittedAt: new Date().toISOString()
    },
    stage: "full_completed"
  };

  const updatedRecord = {
    id,
    created_at: record?.created_at || new Date().toISOString(),
    form_name: NETLIFY_FORM_NAME,
    body: JSON.stringify(updatedPayload),
    data: {
      ...(record?.data || {}),
      fullName: updatedPayload.fullName,
      email: updatedPayload.email,
      phone: updatedPayload.phone,
      submissionPayload: JSON.stringify(updatedPayload)
    }
  };

  await store.setJSON(`submissions/${id}.json`, updatedRecord);

  try {
    await saveReviewRecord(id, {
      stage: "full_completed",
      lastAction: `Step 2 completed on ${new Date().toLocaleDateString()}`
    });
  } catch (err) {
    console.error("Failed to update review record stage:", err);
  }

  return updatedRecord;
}

export async function getEffectiveStoreConfig() {
  const store = await getConfigStore();
  const config = await store.get("store-config.json", { type: "json" });
  return normalizeStoreConfig(config || {});
}

export async function saveEffectiveStoreConfig(nextConfig) {
  const store = await getConfigStore();
  const merged = normalizeStoreConfig(nextConfig || {});
  await store.setJSON("store-config.json", merged);
  return merged;
}

export function normalizeStoreConfig(config = {}) {
  return {
    ...DEFAULT_STORE_CONFIG,
    ...config,
    payMin: Number(config.payMin ?? DEFAULT_STORE_CONFIG.payMin),
    payMax: Number(config.payMax ?? DEFAULT_STORE_CONFIG.payMax),
    minimumHoursNeeded: Number(config.minimumHoursNeeded ?? DEFAULT_STORE_CONFIG.minimumHoursNeeded),
    maximumHoursOffered: Number(config.maximumHoursOffered ?? DEFAULT_STORE_CONFIG.maximumHoursOffered),
    requireSaturday: Boolean(config.requireSaturday ?? DEFAULT_STORE_CONFIG.requireSaturday),
    requireSunday: Boolean(config.requireSunday ?? DEFAULT_STORE_CONFIG.requireSunday),
    requireEvenings: Boolean(config.requireEvenings ?? DEFAULT_STORE_CONFIG.requireEvenings),
    preferEvenings: config.requireEvenings ? false : Boolean(config.preferEvenings ?? DEFAULT_STORE_CONFIG.preferEvenings),
    notificationEmail: config.notificationEmail || DEFAULT_STORE_CONFIG.notificationEmail
  };
}

export function buildApiHeaders() {
  const token = readEnv("NETLIFY_AUTH_TOKEN");
  if (!token) {
    throw new Error("Missing NETLIFY_AUTH_TOKEN.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export function getSiteId() {
  return readEnv("SITE_ID") || readEnv("NETLIFY_SITE_ID") || "";
}

export async function fetchFormDefinition() {
  const siteId = getSiteId();
  if (!siteId) throw new Error("Missing SITE_ID for Netlify API access.");

  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
    headers: buildApiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Unable to load site forms (${response.status}).`);
  }

  const forms = await response.json();
  const form = forms.find((entry) => entry.name === NETLIFY_FORM_NAME);
  if (!form) throw new Error(`Netlify form \"${NETLIFY_FORM_NAME}\" was not found.`);
  return form;
}

export async function fetchFormSubmissions() {
  const form = await fetchFormDefinition();
  const response = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
    headers: buildApiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Unable to load form submissions (${response.status}).`);
  }
  return await response.json();
}

export function parseSubmissionPayload(submission) {
  const payloadText = submission?.data?.submissionPayload || submission?.body || "{}";
  try {
    return JSON.parse(payloadText);
  } catch {
    return {};
  }
}

export function normalizeSubmission(submission, reviewRecord, storeConfig = DEFAULT_STORE_CONFIG) {
  const payload = parseSubmissionPayload(submission);
  const mergedBase = {
    id: submission.id,
    submittedAt: payload.submittedAt || submission.created_at,
    fullName: payload.fullName || submission.name || submission.data?.fullName || "Unknown Applicant",
    email: payload.email || submission.email || submission.data?.email || "",
    phone: payload.phone || submission.data?.phone || "",
    city: payload.city || submission.data?.city || "",
    experienceLevel: payload.experienceLevel || submission.data?.experienceLevel || "first_job",
    position: payload.position || submission.data?.position || "",
    ageBand: payload.ageBand || "",
    authorized: payload.authorized || "",
    hoursWanted: payload.hoursWanted || submission.data?.hoursWanted || "",
    minimumHoursNeeded: Number(payload.minimumHoursNeeded ?? submission.data?.minimumHoursNeeded ?? 0),
    startDate: payload.startDate || "",
    expectedPay: Number(payload.expectedPay ?? submission.data?.expectedPay ?? 0),
    payComfort: payload.payComfort || "",
    canLift: payload.canLift || "",
    enjoysRetail: payload.enjoysRetail || "",
    whyWorkHere: payload.whyWorkHere || "",
    serviceExample: payload.serviceExample || "",
    availability: payload.availability || createBlankAvailability(),
    level2: payload.level2 || null,
    managerNote: reviewRecord?.managerNote ?? "",
    stage: reviewRecord?.stage || payload.stage || "new",
    reviewedAt: reviewRecord?.reviewedAt || null,
    reviewedBy: reviewRecord?.reviewedBy || null,
    lastAction: reviewRecord?.lastAction || null
  };

  const hasTrustedScore = Number.isFinite(Number(payload.score)) && payload.bucket && Array.isArray(payload.flags) && Array.isArray(payload.notes);
  const scored = hasTrustedScore
    ? {
        score: Number(payload.score),
        bucket: payload.bucket,
        bucketLabel: payload.bucketLabel || bucketToLabel(payload.bucket),
        availabilityPercent: Number(payload.availabilityPercent || 0),
        payFitLabel: payload.payFitLabel || "In range",
        flags: payload.flags,
        notes: payload.notes,
        recommendation: payload.recommendation || buildRecommendation(payload.bucket, payload.flags)
      }
    : scoreApplication(mergedBase, storeConfig);

  return {
    ...mergedBase,
    ...scored,
    rawSubmissionId: submission.id,
    formName: submission.form_name || NETLIFY_FORM_NAME,
    referrer: submission.data?.referrer || null
  };
}

export function scoreApplication(candidate, storeConfig = DEFAULT_STORE_CONFIG) {
  let score = 0;
  const flags = [];
  const notes = [];

  if (candidate.authorized === "yes") {
    score += 15;
  } else if (candidate.authorized === "no") {
    flags.push("authorization-review");
    notes.push("Work authorization needs follow-up.");
  }

  const availabilityStats = getAvailabilityStats(candidate.availability);
  score += Math.round(availabilityStats.percent * 0.35);

  if (storeConfig.requireSaturday && !availabilityStats.hasSaturday) {
    flags.push("weekend-missing");
    notes.push("Saturday coverage is missing.");
  } else {
    score += 10;
  }

  if (storeConfig.requireSunday && !availabilityStats.hasSunday) {
    if (!flags.includes("weekend-missing")) flags.push("weekend-missing");
    notes.push("Sunday coverage is missing.");
  } else {
    score += 10;
  }

  if (storeConfig.requireEvenings && !availabilityStats.hasEvening) {
    flags.push("evening-missing");
    notes.push("No evening availability selected.");
  } else {
    score += 12;
  }

  if (!storeConfig.requireEvenings && storeConfig.preferEvenings && availabilityStats.hasEvening) {
    score += 8;
  }

  const expectedPay = Number(candidate.expectedPay || 0);
  if (candidate.payComfort === "yes" && expectedPay <= Number(storeConfig.payMax)) {
    score += 18;
  } else if (expectedPay > Number(storeConfig.payMax) || candidate.payComfort === "no") {
    flags.push("pay-out-of-range");
    notes.push("Pay expectations exceed the posted range.");
  } else {
    score += 8;
  }

  const minHours = Number(candidate.minimumHoursNeeded || 0);
  if (minHours > 0 && minHours <= Number(storeConfig.minimumHoursNeeded) + 10) {
    score += 8;
  } else if (minHours > Number(storeConfig.minimumHoursNeeded) + 10) {
    flags.push("hours-high");
    notes.push("Needs more weekly hours than this store may consistently offer.");
  }

  if (minHours > Number(storeConfig.maximumHoursOffered || 35)) {
    if (!flags.includes("hours-high")) flags.push("hours-high");
    notes.push("Wants more weekly hours than this store plans to offer part-time employees.");
  }

  if (candidate.canLift === "yes") {
    score += 6;
  } else if (candidate.canLift === "no") {
    flags.push("core-duties-mismatch");
    notes.push("Not comfortable with core store duties.");
  }

  if (candidate.enjoysRetail === "yes") {
    score += 6;
  } else if (candidate.enjoysRetail === "no") {
    flags.push("retail-expectation-risk");
    notes.push("May be applying for animal exposure rather than retail work.");
  }

  if ((candidate.whyWorkHere || "").trim().length >= 40) score += 5;
  if ((candidate.serviceExample || "").trim().length >= 40) score += 5;

  const clampedScore = Math.max(0, Math.min(score, 100));
  const bucket = getBucket(clampedScore, flags);

  return {
    score: clampedScore,
    bucket,
    bucketLabel: bucketToLabel(bucket),
    availabilityPercent: availabilityStats.percent,
    payFitLabel: expectedPay > Number(storeConfig.payMax) || candidate.payComfort === "no" ? "Out of range" : "In range",
    flags,
    notes,
    recommendation: buildRecommendation(bucket, flags)
  };
}

export function createBlankAvailability() {
  return DAYS.reduce((days, day) => {
    days[day] = SHIFTS.reduce((shifts, shift) => {
      shifts[shift.id] = false;
      return shifts;
    }, {});
    return days;
  }, {});
}

export function getAvailabilityStats(availability) {
  const totalSlots = DAYS.length * SHIFTS.length;
  let selectedSlots = 0;
  let hasSaturday = false;
  let hasSunday = false;
  let hasEvening = false;

  DAYS.forEach((day) => {
    SHIFTS.forEach((shift) => {
      if (availability?.[day]?.[shift.id]) {
        selectedSlots += 1;
        if (day === "Saturday") hasSaturday = true;
        if (day === "Sunday") hasSunday = true;
        if (shift.id === "evening") hasEvening = true;
      }
    });
  });

  return {
    percent: Math.round((selectedSlots / totalSlots) * 100),
    hasSaturday,
    hasSunday,
    hasEvening
  };
}

export function getBucket(score, flags) {
  if (flags.includes("core-duties-mismatch") || flags.includes("pay-out-of-range")) return "review";
  if (score >= 78) return "top";
  if (score >= 62) return "strong";
  if (score >= 45) return "maybe";
  return "review";
}

export function bucketToLabel(bucket) {
  return {
    top: "Top Match",
    strong: "Strong Match",
    maybe: "Maybe",
    review: "Needs Review"
  }[bucket] || "Needs Review";
}

export function buildRecommendation(bucket, flags) {
  if (bucket === "top") return "Invite to interview now.";
  if (bucket === "strong") return "Review quickly and invite if weekend coverage and weekly hours still line up.";
  if (flags.includes("pay-out-of-range")) return "Decline unless the role budget changes.";
  if (flags.includes("weekend-missing") || flags.includes("evening-missing")) return "Keep as backup only if the store schedule opens up.";
  return "Manager review needed before next step.";
}

export function sortApplicants(applicants) {
  return [...applicants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
}

export async function sendStoreNotificationEmail({ type, applicant, storeConfig }) {
  const config = storeConfig || (await getEffectiveStoreConfig());
  const toEmail = config.notificationEmail || "psp0212@petsuppliesplus.com";

  let subject = "";
  let summarySnippet = "";
  let htmlBody = "";

  if (type === "level1") {
    const position = applicant.position || "Team Member";
    const bucket = applicant.bucketLabel || "New Applicant";
    const score = applicant.score !== undefined ? `${applicant.score}/100` : "Pending";
    subject = `[PSP #0212 Hiring] Level 1 Screen: ${applicant.fullName} (${position} - ${bucket})`;

    htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; background-color: #f4f6f8; }
    .card { background: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: #00AF41; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 24px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; background: #E8F5E9; color: #1B5E20; }
    .field { margin-bottom: 16px; }
    .label { font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
    .value { font-size: 16px; color: #111827; font-weight: 500; }
    .btn { display: inline-block; background: #00AF41; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>New Level 1 Application Received</h1>
      <p>Pet Supplies Plus Battle Creek &bull; Store #0212</p>
    </div>
    <div class="content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <span class="badge">${bucket}</span>
        <span style="font-weight: 700; color: #00AF41;">Score: ${score}</span>
      </div>

      <div class="field">
        <div class="label">Candidate Name</div>
        <div class="value">${applicant.fullName}</div>
      </div>

      <div class="field">
        <div class="label">Position Applied For</div>
        <div class="value">${position} (Starting Pay: $13.73/hr Base)</div>
      </div>

      <div class="field">
        <div class="label">Contact Info</div>
        <div class="value">${applicant.email} &bull; ${applicant.phone || "No phone provided"}</div>
      </div>

      <div class="field">
        <div class="label">Weekly Hours & Availability</div>
        <div class="value">${applicant.hoursWanted || "12-35 hrs/wk"} (Availability Score: ${applicant.availabilityPercent || "N/A"}%)</div>
      </div>

      <div class="field">
        <div class="label">Experience Level</div>
        <div class="value">${applicant.experienceLevel === "first_job" ? "🌱 First Job / Student Candidate" : "💼 Experienced Candidate"}</div>
      </div>

      <div style="margin-top: 24px;">
        <a href="https://psp.battlecreekjobs.app/admin.html" class="btn" style="color:#ffffff;">Open Manager Admin Console</a>
      </div>
    </div>
    <div class="footer">
      Sent automatically by Pet Supplies Plus Store #0212 Hiring Portal to ${toEmail}.
    </div>
  </div>
</body>
</html>`;
    summarySnippet = `New Level 1 Application: ${applicant.fullName} (${position}, ${bucket})`;
  } else if (type === "level2") {
    const l2 = applicant.level2 || {};
    subject = `[PSP #0212 Hiring] Step 2 Completed: ${applicant.fullName} - Ready for Review`;

    const petsText = Array.isArray(l2.petsOwned) ? l2.petsOwned.join(", ") : (l2.petsOwned || "None listed");
    const trackText = l2.experienceTrack === "first_job" ? "🌱 First-Time Job / Student Track" : "💼 Prior Work History Track";

    htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; background-color: #f4f6f8; }
    .card { background: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: #00AF41; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 24px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; background: #E8F5E9; color: #1B5E20; }
    .field { margin-bottom: 16px; }
    .label { font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
    .value { font-size: 15px; color: #111827; }
    .quote { background: #f9fafb; padding: 12px; border-left: 3px solid #00AF41; font-style: italic; font-size: 14px; margin-top: 4px; }
    .btn { display: inline-block; background: #00AF41; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Step 2 Follow-Up Completed</h1>
      <p>Pet Supplies Plus Battle Creek &bull; Store #0212</p>
    </div>
    <div class="content">
      <div style="margin-bottom: 20px;">
        <span class="badge">Level 2 Completed — Ready for Interview</span>
      </div>

      <div class="field">
        <div class="label">Candidate Name</div>
        <div class="value"><strong>${applicant.fullName}</strong> (${applicant.email} &bull; ${applicant.phone || "No phone"})</div>
      </div>

      <div class="field">
        <div class="label">Education & Track</div>
        <div class="value">${l2.lastGradeCompleted || "N/A"} (${l2.schoolName || "N/A"}) &bull; ${trackText}</div>
      </div>

      ${l2.experienceTrack === "first_job" ? `
      <div class="field">
        <div class="label">Activities / Responsibilities</div>
        <div class="quote">${l2.firstJobActivities || "None provided"}</div>
      </div>
      <div class="field">
        <div class="label">What They Want to Learn</div>
        <div class="quote">${l2.firstJobExcitement || "None provided"}</div>
      </div>
      ` : `
      <div class="field">
        <div class="label">Most Recent Employer</div>
        <div class="value"><strong>${l2.emp1Company || "N/A"}</strong> — ${l2.emp1Position || "N/A"} (${l2.emp1Dates || "N/A"})</div>
        <div class="quote">Reason: ${l2.emp1Reason || "N/A"}<br>Duties: ${l2.emp1Duties || "N/A"}</div>
      </div>
      `}

      <div class="field">
        <div class="label">References</div>
        <div class="value">
          1. ${l2.ref1Name || "N/A"} (${l2.ref1Rel || "N/A"}) — ${l2.ref1Phone || "N/A"}<br>
          2. ${l2.ref2Name || "N/A"} (${l2.ref2Rel || "N/A"}) — ${l2.ref2Phone || "N/A"}
        </div>
      </div>

      <div class="field">
        <div class="label">Pet Familiarity</div>
        <div class="value">${petsText}</div>
      </div>

      <div class="field">
        <div class="label">Attendance & Dependability Philosophy</div>
        <div class="quote">${l2.excellentAttendance || "N/A"}</div>
      </div>

      <div class="field">
        <div class="label">Physical Duties (50 lbs lifting / ladders)</div>
        <div class="value"><strong>${l2.physicalRequirements || "Yes"}</strong></div>
      </div>

      <div class="field">
        <div class="label">Digital Signature</div>
        <div class="value">${l2.applicantSignature || applicant.fullName} &bull; Signed ${l2.signatureDate || "Today"}</div>
      </div>

      <div style="margin-top: 24px;">
        <a href="https://psp.battlecreekjobs.app/admin.html" class="btn" style="color:#ffffff;">Review in Manager Console</a>
      </div>
    </div>
    <div class="footer">
      Sent automatically by Pet Supplies Plus Store #0212 Hiring Portal to ${toEmail}.
    </div>
  </div>
</body>
</html>`;
    summarySnippet = `Step 2 Completed: ${applicant.fullName} (${trackText})`;
  }

  // 1. Dispatch via Resend API if configured
  const resendApiKey = readEnv("RESEND_API_KEY");
  let dispatchResult = "logged_local";

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Pet Supplies Plus Battle Creek <hiring@battlecreekjobs.app>",
          to: [toEmail],
          subject,
          html: htmlBody
        })
      });
      if (res.ok) {
        dispatchResult = "dispatched_resend";
      } else {
        console.warn(`Resend API returned ${res.status}`);
        dispatchResult = `resend_error_${res.status}`;
      }
    } catch (err) {
      console.warn("Failed sending via Resend:", err);
      dispatchResult = "resend_network_error";
    }
  }

  // 2. Dispatch via SendGrid API if configured and Resend was not used
  const sendgridApiKey = readEnv("SENDGRID_API_KEY");
  if (sendgridApiKey && dispatchResult !== "dispatched_resend") {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: "psp0212@petsuppliesplus.com", name: "Pet Supplies Plus Battle Creek" },
          subject,
          content: [{ type: "text/html", value: htmlBody }]
        })
      });
      if (res.ok) {
        dispatchResult = "dispatched_sendgrid";
      }
    } catch (err) {
      console.warn("Failed sending via SendGrid:", err);
    }
  }

  // 3. Log notification event into Netlify Blobs for audit trail
  try {
    const adminStore = await getReviewStore();
    const notifId = `notif-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    await adminStore.setJSON(`notifications/${notifId}.json`, {
      id: notifId,
      type,
      recipient: toEmail,
      subject,
      candidateId: applicant.id,
      candidateName: applicant.fullName,
      sentAt: new Date().toISOString(),
      status: dispatchResult,
      summary: summarySnippet
    });
  } catch (logErr) {
    console.warn("Failed to log notification record in blobs:", logErr);
  }

  return { dispatched: dispatchResult.startsWith("dispatched"), status: dispatchResult, recipient: toEmail };
}
