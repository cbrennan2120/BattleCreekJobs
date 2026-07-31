import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { fromStoreLocalInput } from "../src/date";

describe("database concurrency contract", () => {
  it("enforces one resource claim per 30-minute start", () => {
    const migrationRoot = join(process.cwd(), "netlify", "database", "migrations");
    const directory = readdirSync(migrationRoot, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && /^\d+_[a-z0-9_-]+$/.test(entry.name))?.name;
    if (!directory) throw new Error("Expected a Netlify migration directory named <number>_<slug>.");
    const sql = readFileSync(join(migrationRoot, directory, "migration.sql"), "utf8");
    expect(sql).toContain('CREATE UNIQUE INDEX "booking_slots_resource_start_unique" ON "booking_slots" ("resource_id","slot_start")');
  });

  it("adds recurrence metadata and lets holds use the same unique slot claims", () => {
    const migration = readFileSync(join(process.cwd(), "netlify", "database", "migrations", "20260731210000_manual-recurring-entries", "migration.sql"), "utf8");
    expect(migration).toContain('CREATE TABLE "recurrence_series"');
    expect(migration).toContain('ADD COLUMN "source" text DEFAULT \'public\' NOT NULL');
    expect(migration).toContain('ADD COLUMN "blackout_id" uuid');
    const schema = readFileSync(join(process.cwd(), "db", "schema.ts"), "utf8");
    expect(schema).toContain('uniqueIndex("booking_slots_resource_start_unique")');
  });
});

describe("public privacy contract", () => {
  it("keeps private manual-entry fields out of public availability types", () => {
    const scheduling = readFileSync(join(process.cwd(), "netlify", "functions", "_shared", "scheduling.ts"), "utf8");
    const publicInterface = scheduling.slice(scheduling.indexOf("export interface PublicSlot"), scheduling.indexOf("export function generateAvailability"));
    expect(publicInterface).not.toMatch(/contactName|email|phone|privateNotes|reason|seriesId|manageToken/);
  });
});

describe("public shell", () => {
  it("uses the supplied logo without upscaling and states the privacy boundary", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('width="162"');
    expect(html).toContain('height="100"');
    expect(html).toContain('alt="Pet Supplies Plus"');
    expect(html).toContain("Personal contact information is visible only to store staff");
  });

  it("interprets visitor-entered wall time in the Battle Creek timezone", () => {
    expect(fromStoreLocalInput("2026-08-10T09:00")).toBe("2026-08-10T13:00:00.000Z");
    expect(fromStoreLocalInput("2026-12-10T09:00")).toBe("2026-12-10T14:00:00.000Z");
  });
});
