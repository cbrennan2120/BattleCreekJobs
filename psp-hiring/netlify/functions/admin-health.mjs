import {
  LEGACY_DEFAULT_ADMIN_CODE,
  errorResponse,
  getEffectiveStoreConfig,
  getApplicantStore,
  getManagerAccessCode,
  getReviewStore,
  jsonResponse,
  requireAdminSession
} from "./_lib/hiring-core.mjs";

export default async (request) => {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const storeConfig = await getEffectiveStoreConfig();

  const result = {
    intakeReachable: false,
    formsReachable: false,
    storageReachable: false,
    unresolvedSaveFailures: 0,
    usingLegacyManagerCode: getManagerAccessCode() === LEGACY_DEFAULT_ADMIN_CODE,
    usingDefaultManagerCode: getManagerAccessCode() === LEGACY_DEFAULT_ADMIN_CODE,
    applicantCount: 0,
    schedulingConfigured: Boolean(storeConfig.schedulingLink && storeConfig.interviewWindow),
    payConfigured: Number(storeConfig.payMin) === 13.73 && Number(storeConfig.payMax) === 13.73
  };

  try {
    const store = await getApplicantStore();
    const { blobs } = await store.list({ prefix: "submissions/" });
    result.intakeReachable = true;
    result.formsReachable = true;
    result.applicantCount = blobs.length;
  } catch (error) {
    return errorResponse("Unable to load live application intake health.", 502, { details: String(error) });
  }

  try {
    const store = await getReviewStore();
    await store.list({ prefix: "reviews/" });
    result.storageReachable = true;
  } catch (error) {
    result.storageReachable = false;
    result.storageError = String(error);
  }

  return jsonResponse(result);
};

export const config = {
  path: "/api/admin/health"
};
