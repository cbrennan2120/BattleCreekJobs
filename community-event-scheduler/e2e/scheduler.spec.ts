import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function slotsForWeek(weekStart: string) {
  const slots = [];
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(`${weekStart}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + day);
    const key = date.toISOString().slice(0, 10);
    for (const hour of [14, 15, 16]) {
      slots.push({ start: `${key}T${hour}:00:00-04:00`, end: `${key}T${hour + 1}:00:00-04:00`, state: "available" });
    }
  }
  return slots;
}

async function mockAvailability(page: Page) {
  await page.route("**/api/availability?**", async (route) => {
    const url = new URL(route.request().url());
    const weekStart = url.searchParams.get("weekStart") ?? "2026-08-03";
    await route.fulfill({ json: { timezone: "America/Detroit", weekStart, generatedAt: `${weekStart}T16:00:00Z`, slots: slotsForWeek(weekStart) } });
  });
}

test.beforeEach(async ({ page }) => { await mockAvailability(page); });

test("schedule reflows, exposes accessible mobile tabs, and has no serious axe findings", async ({ page, isMobile }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Community schedule" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  if (isMobile) {
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(7);
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toBeFocused();
  } else {
    await expect(page.locator(".day-card")).toHaveCount(7);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("booking dialog uses explicit date and hour controls and restores focus", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const opener = page.getByRole("button", { name: "Reserve the space" }).first();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await expect(dialog.getByLabel("Date")).toBeVisible();
  await expect(dialog.getByLabel("Start time")).toHaveValue("09:00");
  await expect(dialog.getByLabel("Start time").locator("option")).toHaveCount(24);
  expect(await page.evaluate(() => document.body.classList.contains("modal-open"))).toBe(true);
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("manage page edits details without changing the schedule and supports cancellation", async ({ page }, testInfo) => {
  test.skip(!["chromium-desktop", "chromium-mobile"].includes(testInfo.project.name), "representative desktop and mobile workflow test");
  const original = { groupName: "Tomorrow's Tails", category: "Rescue Organization", contactName: "Test User", email: "test@example.com", phone: "269-555-0100", privateNotes: "Original note", status: "confirmed", start: "2026-08-08T18:00:00.000Z", end: "2026-08-08T21:00:00.000Z" };
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/manage/test-token", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: original });
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ json: { ...original, groupName: submitted.groupName, category: submitted.category, contactName: submitted.contactName, phone: submitted.phone, privateNotes: submitted.privateNotes } });
  });
  await page.goto("/manage/test-token", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Manage your event" })).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await expect(page.getByLabel("Start time")).toHaveValue("14:00");
  await expect(page.getByLabel("Verified email")).toHaveValue("test@example.com");
  await expect(page.getByLabel("Verified email")).toHaveAttribute("readonly", "");
  await page.getByLabel("Group or event name").fill("Updated Adoption Event");
  await page.getByLabel("Event category").selectOption("Community Event");
  await page.getByLabel("Contact name").fill("Updated Contact");
  await page.getByLabel("Phone (optional)").fill("");
  await page.getByLabel("Notes for store staff (optional and private)").fill("Updated note");
  await page.getByRole("button", { name: "Save reservation details" }).click();
  await expect(page.getByRole("status")).toContainText("reservation details have been updated");
  expect(submitted).toEqual({ action: "update_details", groupName: "Updated Adoption Event", category: "Community Event", contactName: "Updated Contact", privateNotes: "Updated note" });
  expect(submitted).not.toHaveProperty("email");
  expect(submitted).not.toHaveProperty("start");
  expect(submitted).not.toHaveProperty("end");
  await expect(page.getByLabel("Start time")).toHaveValue("14:00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  const cancel = page.getByRole("button", { name: "Cancel reservation" });
  await cancel.click();
  await expect(page.getByRole("dialog", { name: "Cancel this reservation?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cancel).toBeFocused();
});

test("staff login and dashboard tabs meet keyboard and hourly-input contracts", async ({ page }, testInfo) => {
  test.skip(!["chromium-desktop", "chromium-mobile"].includes(testInfo.project.name), "representative staff workflow test");
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  const loginAxe = await new AxeBuilder({ page }).analyze();
  expect(loginAxe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.addInitScript(() => sessionStorage.setItem("psp-admin-csrf", "test-csrf"));
  await page.route("**/api/admin/bookings", (route) => route.fulfill({ json: { bookings: [] } }));
  await page.route("**/api/admin/hours", (route) => route.fulfill({ json: { hours: Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1), dayOfWeek: index + 1, opensAt: "09:00", closesAt: "21:00", isClosed: false })) } }));
  await page.route("**/api/admin/blackouts", (route) => route.fulfill({ json: { blackouts: [] } }));
  await page.route("**/api/admin/audit", (route) => route.fulfill({ json: { audit: [
    { id: "audit-ipv6", action: "booking_confirmed", entityType: "booking", actorLabel: null, ipAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334", createdAt: "2026-08-01T18:00:00.000Z" },
    { id: "audit-historical", action: "booking_started", entityType: "booking", actorLabel: null, ipAddress: null, createdAt: "2026-07-31T18:00:00.000Z" },
  ] } }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: "bookings" })).toBeVisible();
  await page.getByRole("tab", { name: "bookings" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "hours" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "hours" })).toBeVisible();
  await expect(page.getByLabel("Monday opening time").locator("option")).toHaveCount(24);
  await page.getByRole("tab", { name: "blackouts" }).click();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await expect(page.getByRole("tabpanel", { name: "blackouts" }).getByLabel("Start time").locator("option")).toHaveCount(24);
  await page.getByRole("tab", { name: "audit" }).click();
  await expect(page.getByRole("columnheader", { name: "IP address" })).toBeVisible();
  await expect(page.getByText("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBeVisible();
  await expect(page.getByText("Not recorded")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("schedule failure is announced and remains recoverable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "representative failure-state test");
  await page.unroute("**/api/availability?**");
  await page.route("**/api/availability?**", (route) => route.fulfill({ status: 503, json: { error: "Temporary outage" } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toContainText("Temporary outage");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
