import { getStore, getDeployStore } from "@netlify/blobs";
import { errorResponse, jsonResponse, requireAdminSession } from "./_lib/hiring-core.mjs";

export const ROSTER_STORE_NAME = "psp-roster-store";

export const DEFAULT_ROSTER = [
  { id: "tm-1", category: "Team Member", name: "Amber", legalName: "", teamMemberNumber: "68", phone: "269-666-4471", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-2", category: "Team Member", name: "Aren", legalName: "", teamMemberNumber: "6", phone: "269-986-9369", role: "TL", active: true, notes: "", email: "" },
  { id: "tm-3", category: "Team Member", name: "Ashley", legalName: "", teamMemberNumber: "", phone: "269-579-2490", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-4", category: "Team Member", name: "Bri", legalName: "Brianna", teamMemberNumber: "75", phone: "269-213-7031", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-5", category: "Team Member", name: "Brittney", legalName: "", teamMemberNumber: "76", phone: "269-318-6335", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-6", category: "Team Member", name: "Camden", legalName: "", teamMemberNumber: "86", phone: "269-275-6710", role: "Stock", active: true, notes: "", email: "" },
  { id: "tm-7", category: "Team Member", name: "Carson", legalName: "", teamMemberNumber: "", phone: "269-762-9444", role: "Stock", active: true, notes: "", email: "" },
  { id: "tm-8", category: "Team Member", name: "Chelsea", legalName: "", teamMemberNumber: "39", phone: "269-578-2806", role: "TL", active: true, notes: "", email: "" },
  { id: "tm-9", category: "Team Member", name: "Chris", legalName: "Chris Brennan", teamMemberNumber: "1", phone: "269-808-0491", role: "STL", active: true, notes: "Manager", email: "cbrennan2120@gmail.com" },
  { id: "tm-10", category: "Team Member", name: "Damyen", legalName: "", teamMemberNumber: "", phone: "269-298-0433", role: "Stock", active: true, notes: "", email: "" },
  { id: "tm-11", category: "Team Member", name: "Emily", legalName: "", teamMemberNumber: "46", phone: "269-274-0430", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-12", category: "Team Member", name: "Josie", legalName: "", teamMemberNumber: "8", phone: "269-213-6032", role: "TL", active: true, notes: "", email: "" },
  { id: "tm-13", category: "Team Member", name: "Justin", legalName: "", teamMemberNumber: "", phone: "269-578-8043", role: "Stock", active: true, notes: "", email: "" },
  { id: "tm-14", category: "Team Member", name: "Kailey", legalName: "", teamMemberNumber: "83", phone: "269-275-4001", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-15", category: "Team Member", name: "Katie", legalName: "", teamMemberNumber: "88", phone: "269-845-7854", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-16", category: "Team Member", name: "Kyle", legalName: "", teamMemberNumber: "70", phone: "269-775-2930", role: "Stock", active: true, notes: "", email: "" },
  { id: "tm-17", category: "Team Member", name: "Madison", legalName: "", teamMemberNumber: "", phone: "269-245-6353", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-18", category: "Team Member", name: "Mary", legalName: "", teamMemberNumber: "56", phone: "269-589-5878", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-19", category: "Team Member", name: "Meghan", legalName: "", teamMemberNumber: "35", phone: "269-339-1875", role: "Groomer", active: true, notes: "", email: "" },
  { id: "tm-20", category: "Team Member", name: "Savannah", legalName: "Savanna", teamMemberNumber: "67", phone: "269-419-2920", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-21", category: "Team Member", name: "Sophia", legalName: "", teamMemberNumber: "60", phone: "269-832-6944", role: "Cashier", active: true, notes: "", email: "" },
  { id: "tm-22", category: "Team Member", name: "Trisha", legalName: "", teamMemberNumber: "7", phone: "517-812-3298", role: "ASTL", active: true, notes: "", email: "" },
  { id: "dir-1", category: "Sister Store", name: "Portage Store", legalName: "", teamMemberNumber: "Store 77", phone: "269-341-9252", role: "Sister Store", active: true, notes: "", email: "" },
  { id: "dir-2", category: "Sister Store", name: "Kalamazoo Store (Gull)", legalName: "", teamMemberNumber: "Store 170", phone: "269-342-5020", role: "Sister Store", active: true, notes: "", email: "" },
  { id: "dir-3", category: "Sister Store", name: "Goshen Store (Indiana)", legalName: "", teamMemberNumber: "Store 166", phone: "574-875-9199", role: "Sister Store", active: true, notes: "", email: "" },
  { id: "dir-4", category: "Corporate", name: "Olivia Perry", legalName: "", teamMemberNumber: "#203", phone: "810-449-4977", role: "Corporate", active: true, notes: "District Leader / Operations", email: "" },
  { id: "dir-5", category: "Facility Support", name: "Andy Freier", legalName: "", teamMemberNumber: "", phone: "701-715-2253", role: "Facility Support", active: true, notes: "Property & Facility Support", email: "" },
  { id: "dir-6", category: "Facility Support", name: "Delivery Van", legalName: "", teamMemberNumber: "", phone: "269-532-0254", role: "Facility Support", active: true, notes: "Store Delivery Van", email: "" },
  { id: "dir-7", category: "Corporate", name: "Robyn", legalName: "Robyn", teamMemberNumber: "", phone: "269-377-5991", role: "Corporate", active: true, notes: "robynmsu2@yahoo.com (Payroll / Franchise Ops)", email: "robynmsu2@yahoo.com" },
  { id: "dir-8", category: "Corporate", name: "Brandon", legalName: "Brandon Byron", teamMemberNumber: "", phone: "269-910-9522", role: "Corporate", active: true, notes: "brandon.byron@gmail.com (Franchise Leadership)", email: "brandon.byron@gmail.com" }
];

let inMemoryRoster = null;

async function getRosterStore() {
  try {
    return getStore(ROSTER_STORE_NAME, { consistency: "strong" });
  } catch {
    return getDeployStore(ROSTER_STORE_NAME);
  }
}

async function loadRosterRecords() {
  try {
    const store = await getRosterStore();
    const stored = await store.get("roster.json", { type: "json" });
    if (Array.isArray(stored) && stored.length > 0) {
      inMemoryRoster = stored;
      return stored;
    }
  } catch {
    // If blob storage is unconfigured or offline in local dev, use in-memory cache
  }

  if (!inMemoryRoster) {
    inMemoryRoster = JSON.parse(JSON.stringify(DEFAULT_ROSTER));
    try {
      const store = await getRosterStore();
      await store.setJSON("roster.json", inMemoryRoster);
    } catch {
      // ignore
    }
  }

  return inMemoryRoster;
}

async function saveRosterRecords(roster) {
  inMemoryRoster = roster;
  try {
    const store = await getRosterStore();
    await store.setJSON("roster.json", roster);
  } catch {
    // stored in in-memory cache
  }
  return inMemoryRoster;
}

function getIdFromRequest(request) {
  const url = new URL(request.url);
  const qId = url.searchParams.get("id");
  if (qId) return qId;
  const segments = url.pathname.split("/").filter(Boolean);
  // /api/admin/roster/:id
  const idx = segments.indexOf("roster");
  if (idx !== -1 && segments.length > idx + 1) {
    return segments[idx + 1];
  }
  return null;
}

export default async (request) => {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);

  if (request.method === "GET") {
    try {
      const roster = await loadRosterRecords();
      return jsonResponse({ roster, count: roster.length, store: "0212" });
    } catch (error) {
      return errorResponse("Unable to load team roster.", 500, { details: String(error) });
    }
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload.", 400);
    }

    const name = String(body.name || "").trim();
    if (!name) {
      return errorResponse("Team member name is required.", 400);
    }

    const roster = await loadRosterRecords();
    const newId = `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newMember = {
      id: newId,
      category: body.category || "Team Member",
      name: name,
      legalName: String(body.legalName || "").trim(),
      teamMemberNumber: String(body.teamMemberNumber || "").trim(),
      phone: String(body.phone || "").trim(),
      role: body.role || "Cashier Team Member",
      active: body.active !== false,
      notes: String(body.notes || "").trim(),
      email: String(body.email || "").trim(),
      createdAt: new Date().toISOString()
    };

    roster.push(newMember);
    await saveRosterRecords(roster);
    return jsonResponse({ success: true, member: newMember, count: roster.length }, { status: 201 });
  }

  if (request.method === "PATCH") {
    const id = getIdFromRequest(request);
    if (!id) {
      return errorResponse("Missing team member id for update.", 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload.", 400);
    }

    const roster = await loadRosterRecords();
    const index = roster.findIndex((m) => m.id === id);
    if (index === -1) {
      return errorResponse(`Team member with ID '${id}' not found.`, 404);
    }

    const existing = roster[index];
    const updated = {
      ...existing,
      ...body,
      id: existing.id, // keep immutable id
      updatedAt: new Date().toISOString()
    };

    if (body.active !== undefined) {
      updated.active = Boolean(body.active);
    }

    roster[index] = updated;
    await saveRosterRecords(roster);
    return jsonResponse({ success: true, member: updated });
  }

  if (request.method === "DELETE") {
    const id = getIdFromRequest(request);
    if (!id) {
      return errorResponse("Missing team member id for deletion.", 400);
    }

    const roster = await loadRosterRecords();
    const index = roster.findIndex((m) => m.id === id);
    if (index === -1) {
      return errorResponse(`Team member with ID '${id}' not found.`, 404);
    }

    const [deleted] = roster.splice(index, 1);
    await saveRosterRecords(roster);
    return jsonResponse({ success: true, deletedMember: deleted, count: roster.length });
  }

  return errorResponse("Method not allowed", 405);
};

export const config = {
  path: "/api/admin/roster"
};
