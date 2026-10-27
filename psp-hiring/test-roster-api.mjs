import assert from "node:assert";
import rosterHandler from "./netlify/functions/admin-roster.mjs";
import { createSessionCookie } from "./netlify/functions/_lib/hiring-core.mjs";

async function runTests() {
  console.log("Testing Roster API Functionality...");

  // Generate valid session cookie header
  const dummyReq = new Request("https://psp.battlecreekjobs.app/api/admin/session");
  const cookieHeader = createSessionCookie(dummyReq);

  // 1. Test GET (loads initial default roster)
  const getReq = new Request("https://psp.battlecreekjobs.app/api/admin/roster", {
    method: "GET",
    headers: { cookie: cookieHeader }
  });
  const getRes = await rosterHandler(getReq);
  assert.strictEqual(getRes.status, 200, "GET should return 200");
  const getData = await getRes.json();
  assert.ok(Array.isArray(getData.roster), "roster should be an array");
  assert.ok(getData.roster.length >= 22, "should contain initial seeded team members");
  console.log(`[PASS] GET returned ${getData.roster.length} roster entries.`);

  // Verify specific initial member (Brianna / Bri #75)
  const bri = getData.roster.find((m) => m.name === "Bri");
  assert.ok(bri, "Bri should exist");
  assert.strictEqual(bri.teamMemberNumber, "75");
  assert.strictEqual(bri.active, true);
  console.log("[PASS] Bri verified with TM #75 and Active=true.");

  // Verify Facility Support (Andy) & Horn Group (Robyn) & PSP Corporate (Olivia)
  const andy = getData.roster.find((m) => m.name === "Andy Freier");
  assert.ok(andy, "Andy Freier should exist");
  assert.strictEqual(andy.category, "Facility Support");
  console.log("[PASS] Andy Freier verified under Facility Support.");

  const robyn = getData.roster.find((m) => m.name === "Robyn");
  assert.ok(robyn, "Robyn should exist");
  assert.strictEqual(robyn.category, "Horn Group");
  console.log("[PASS] Robyn verified under Horn Group.");

  const olivia = getData.roster.find((m) => m.name === "Olivia Perry");
  assert.ok(olivia, "Olivia Perry should exist");
  assert.strictEqual(olivia.category, "PSP Corporate");
  console.log("[PASS] Olivia Perry verified under PSP Corporate.");

  // 2. Test POST (add new team member)
  const postReq = new Request("https://psp.battlecreekjobs.app/api/admin/roster", {
    method: "POST",
    headers: {
      cookie: cookieHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Jordan",
      legalName: "Jordan Smith",
      teamMemberNumber: "91",
      phone: "269-555-1234",
      role: "Cashier Team Member",
      active: true,
      notes: "Newly onboarded"
    })
  });
  const postRes = await rosterHandler(postReq);
  assert.strictEqual(postRes.status, 201, "POST should return 201 Created");
  const postData = await postRes.json();
  assert.ok(postData.member.id, "created member should have an ID");
  assert.strictEqual(postData.member.name, "Jordan");
  const createdId = postData.member.id;
  console.log(`[PASS] POST added member ${postData.member.name} (ID: ${createdId}).`);

  // 3. Test PATCH (toggle active state or update fields)
  const patchReq = new Request(`https://psp.battlecreekjobs.app/api/admin/roster?id=${createdId}`, {
    method: "PATCH",
    headers: {
      cookie: cookieHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      active: false,
      notes: "Transferred to inactive / seasonal"
    })
  });
  const patchRes = await rosterHandler(patchReq);
  assert.strictEqual(patchRes.status, 200, "PATCH should return 200 OK");
  const patchData = await patchRes.json();
  assert.strictEqual(patchData.member.active, false, "Active state should now be false");
  assert.strictEqual(patchData.member.notes, "Transferred to inactive / seasonal");
  console.log(`[PASS] PATCH successfully marked member inactive.`);

  // 4. Test DELETE
  const delReq = new Request(`https://psp.battlecreekjobs.app/api/admin/roster?id=${createdId}`, {
    method: "DELETE",
    headers: { cookie: cookieHeader }
  });
  const delRes = await rosterHandler(delReq);
  assert.strictEqual(delRes.status, 200, "DELETE should return 200 OK");
  const delData = await delRes.json();
  assert.strictEqual(delData.deletedMember.id, createdId);
  console.log(`[PASS] DELETE removed test member successfully.`);

  console.log("All Roster API tests PASSED successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
