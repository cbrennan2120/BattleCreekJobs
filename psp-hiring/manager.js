// Pet Supplies Plus Store #0212 - Master Manager Portal & Roster Controller
(function () {
  "use strict";

  const state = {
    authenticated: false,
    roster: [],
    loading: false,
    activeTab: "active", // "active" | "inactive" | "all" | "directory"
    searchQuery: "",
    editingId: null,
    toastTimeout: null
  };

  // DOM Elements
  const gateShell = document.getElementById("admin-gate-shell");
  const loginForm = document.getElementById("admin-login-form");
  const accessCodeInput = document.getElementById("admin-access-code");
  const gateNote = document.getElementById("admin-gate-note");
  const portalDashboard = document.getElementById("manager-portal");
  const logoutBtn = document.getElementById("admin-logout");

  // Stat Elements
  const statActiveCount = document.getElementById("stat-active-count");
  const statInactiveCount = document.getElementById("stat-inactive-count");
  const statFacilityCount = document.getElementById("stat-facility-count");
  const statCorpCount = document.getElementById("stat-corp-count");

  // View Containers
  const rosterViewContainer = document.getElementById("roster-view-container");
  const onboardingViewContainer = document.getElementById("onboarding-view-container");

  // Onboarding Form Elements
  const onboardingForm = document.getElementById("onboarding-form");
  const obHireDateInput = document.getElementById("ob-hire-date");
  const obDobInput = document.getElementById("ob-dob");
  const obMinorCheckbox = document.getElementById("ob-minor");
  const btnDownloadExcelOnly = document.getElementById("btn-download-excel-only");
  const btnCopyEmailOnly = document.getElementById("btn-copy-email-only");
  const btnResetOnboarding = document.getElementById("btn-reset-onboarding");
  const onboardingResultBox = document.getElementById("onboarding-result-box");
  const onboardingResultSummary = document.getElementById("onboarding-result-summary");
  const emailPreviewContent = document.getElementById("email-preview-content");
  const btnOpenEmailClient = document.getElementById("btn-open-email-client");
  const btnCopyGeneratedEmail = document.getElementById("btn-copy-generated-email");
  const btnBackToRoster = document.getElementById("btn-back-to-roster");

  // Filter Elements
  const searchInput = document.getElementById("roster-search");
  const tabButtons = Array.from(document.querySelectorAll("[data-roster-tab]"));
  const rosterTbody = document.getElementById("roster-tbody");
  const emptyState = document.getElementById("roster-empty-state");

  // Action Buttons
  const addMemberBtn = document.getElementById("btn-add-member");
  const exportCsvBtn = document.getElementById("btn-export-csv");
  const exportJsonBtn = document.getElementById("btn-export-json");
  const refreshBtn = document.getElementById("btn-refresh-roster");

  // Modal Elements
  const memberModal = document.getElementById("member-modal");
  const memberForm = document.getElementById("member-form");
  const modalTitle = document.getElementById("modal-title");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalCloseBtn = document.getElementById("modal-close-btn");

  // Form Fields
  const inputCategory = document.getElementById("modal-category");
  const inputName = document.getElementById("modal-name");
  const inputLegalName = document.getElementById("modal-legal-name");
  const inputTmNumber = document.getElementById("modal-tm-number");
  const inputPhone = document.getElementById("modal-phone");
  const inputRole = document.getElementById("modal-role");
  const inputNotes = document.getElementById("modal-notes");
  const inputActive = document.getElementById("modal-active");

  // Toast Notification
  const toastEl = document.getElementById("portal-toast");

  function showToast(message, type = "success") {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `portal-toast show ${type}`;
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => {
      toastEl.className = "portal-toast";
    }, 3500);
  }

  // --- Auth & Session Management ---
  async function checkSession() {
    try {
      const res = await fetch("/api/admin/session", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
          await loadRoster();
          return;
        }
      }
    } catch (e) {
      console.warn("Session check failed", e);
    }
    setAuthenticated(false);
  }

  function setAuthenticated(isAuth) {
    state.authenticated = isAuth;
    if (isAuth) {
      if (gateShell) gateShell.hidden = true;
      if (portalDashboard) portalDashboard.hidden = false;
    } else {
      if (gateShell) gateShell.hidden = false;
      if (portalDashboard) portalDashboard.hidden = true;
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const code = (accessCodeInput.value || "").trim();
    if (!code) {
      if (gateNote) gateNote.textContent = "Please enter the manager access code.";
      return;
    }

    try {
      if (gateNote) gateNote.textContent = "Verifying manager credentials...";
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      if (res.ok) {
        if (gateNote) gateNote.textContent = "";
        accessCodeInput.value = "";
        setAuthenticated(true);
        await loadRoster();
        showToast("Manager access granted.", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        if (gateNote) gateNote.textContent = err.error || "Incorrect manager code. Please try again.";
      }
    } catch {
      if (gateNote) gateNote.textContent = "Network error verifying code. Try again.";
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAuthenticated(false);
    showToast("Logged out successfully.", "info");
  }

  // --- Roster API & Operations ---
  async function loadRoster() {
    state.loading = true;
    renderRoster();
    try {
      const res = await fetch("/api/admin/roster", { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error("Failed to load roster data");
      }
      const data = await res.json();
      state.roster = data.roster || [];
      updateStats();
      renderRoster();
    } catch (err) {
      console.error(err);
      showToast("Unable to load roster from store server.", "error");
    } finally {
      state.loading = false;
      renderRoster();
    }
  }

  function updateStats() {
    const teamMembers = state.roster.filter((m) => m.category === "Team Member" || !m.category);
    const activeStaff = teamMembers.filter((m) => m.active);
    const inactiveStaff = teamMembers.filter((m) => !m.active);
    const facilityVendors = state.roster.filter((m) => m.category === "Facility Support" || m.category === "Vendors");
    const hornCorp = state.roster.filter((m) => m.category === "Horn Group" || m.category === "PSP Corporate");

    if (statActiveCount) statActiveCount.textContent = activeStaff.length;
    if (statInactiveCount) statInactiveCount.textContent = inactiveStaff.length;
    if (statFacilityCount) statFacilityCount.textContent = facilityVendors.length;
    if (statCorpCount) statCorpCount.textContent = hornCorp.length;
  }

  function getFilteredRoster() {
    const q = state.searchQuery.toLowerCase().trim();
    return state.roster.filter((item) => {
      const isTeam = item.category === "Team Member" || !item.category;

      // Tab matching
      if (state.activeTab === "active" && (!isTeam || !item.active)) return false;
      if (state.activeTab === "inactive" && (!isTeam || item.active)) return false;
      if (state.activeTab === "all" && !isTeam) return false;
      if (state.activeTab === "facility" && item.category !== "Facility Support" && item.category !== "Vendors") return false;
      if (state.activeTab === "horngroup" && item.category !== "Horn Group" && item.category !== "PSP Corporate") return false;
      if (state.activeTab === "sisterstores" && item.category !== "Sister Store") return false;

      // Search matching
      if (q) {
        const nameMatch = (item.name || "").toLowerCase().includes(q);
        const legalMatch = (item.legalName || "").toLowerCase().includes(q);
        const phoneMatch = (item.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
        const roleMatch = (item.role || "").toLowerCase().includes(q);
        const categoryMatch = (item.category || "").toLowerCase().includes(q);
        const notesMatch = (item.notes || "").toLowerCase().includes(q);
        const tmNumMatch = String(item.teamMemberNumber || "").toLowerCase().includes(q);
        if (!nameMatch && !legalMatch && !phoneMatch && !roleMatch && !categoryMatch && !notesMatch && !tmNumMatch) {
          return false;
        }
      }

      return true;
    });
  }

  function renderRoster() {
    if (!rosterTbody) return;
    rosterTbody.innerHTML = "";

    if (state.loading) {
      rosterTbody.innerHTML = `<tr><td colspan="7" class="table-loading">Loading roster...</td></tr>`;
      if (emptyState) emptyState.hidden = true;
      return;
    }

    const filtered = getFilteredRoster();

    if (filtered.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    filtered.forEach((member) => {
      const tr = document.createElement("tr");
      tr.className = member.active ? "roster-row" : "roster-row inactive-row";

      // Name & Alias
      const tdName = document.createElement("td");
      tdName.className = "cell-name";
      let nameHtml = `<strong>${escapeHtml(member.name)}</strong>`;
      if (member.legalName && member.legalName !== member.name) {
        nameHtml += ` <span class="alias-pill" title="Legal Name: ${escapeHtml(member.legalName)}">Legal: ${escapeHtml(member.legalName)}</span>`;
      }
      tdName.innerHTML = nameHtml;

      // TM Number
      const tdNum = document.createElement("td");
      tdNum.innerHTML = member.teamMemberNumber ? `<span class="tm-badge">#${escapeHtml(member.teamMemberNumber)}</span>` : `<span class="muted-text">—</span>`;

      // Phone
      const tdPhone = document.createElement("td");
      if (member.phone) {
        const cleanPhone = member.phone.replace(/[^\d+]/g, "");
        tdPhone.innerHTML = `<a href="tel:${cleanPhone}" class="phone-link">${escapeHtml(member.phone)}</a>`;
      } else {
        tdPhone.innerHTML = `<span class="muted-text">—</span>`;
      }

      // Role
      const tdRole = document.createElement("td");
      tdRole.innerHTML = `<span class="role-badge role-${sanitizeClass(member.role)}">${escapeHtml(member.role || "Team Member")}</span>`;

      // Status
      const tdStatus = document.createElement("td");
      tdStatus.innerHTML = member.active
        ? `<span class="status-pill active-pill"><span class="status-dot green"></span> Active</span>`
        : `<span class="status-pill inactive-pill"><span class="status-dot gray"></span> Inactive</span>`;

      // Notes
      const tdNotes = document.createElement("td");
      tdNotes.className = "cell-notes";
      tdNotes.textContent = member.notes || "—";

      // Actions
      const tdActions = document.createElement("td");
      tdActions.className = "cell-actions";

      // Toggle Active button
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = member.active ? "button-action button-deactivate" : "button-action button-reactivate";
      toggleBtn.textContent = member.active ? "Mark Inactive" : "Reactivate";
      toggleBtn.title = member.active ? "Set status to Inactive" : "Set status to Active";
      toggleBtn.addEventListener("click", () => toggleMemberActive(member));

      // Edit button
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "button-action button-edit";
      editBtn.textContent = "Edit";
      editBtn.title = "Edit contact info and role";
      editBtn.addEventListener("click", () => openEditModal(member));

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "button-action button-delete";
      delBtn.textContent = "×";
      delBtn.title = "Delete record permanently";
      delBtn.addEventListener("click", () => deleteMember(member));

      tdActions.appendChild(toggleBtn);
      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdNum);
      tr.appendChild(tdPhone);
      tr.appendChild(tdRole);
      tr.appendChild(tdStatus);
      tr.appendChild(tdNotes);
      tr.appendChild(tdActions);

      rosterTbody.appendChild(tr);
    });
  }

  async function toggleMemberActive(member) {
    const nextState = !member.active;
    const actionLabel = nextState ? "reactivate" : "mark inactive";
    if (!confirm(`Are you sure you want to ${actionLabel} ${member.name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/roster?id=${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextState })
      });

      if (!res.ok) {
        throw new Error("Update failed");
      }

      const data = await res.json();
      const idx = state.roster.findIndex((m) => m.id === member.id);
      if (idx !== -1) {
        state.roster[idx] = data.member;
      }
      updateStats();
      renderRoster();
      showToast(`${member.name} marked as ${nextState ? "Active" : "Inactive"}.`, "success");
    } catch {
      showToast(`Error updating status for ${member.name}.`, "error");
    }
  }

  async function deleteMember(member) {
    const confirmed = confirm(
      `Permanently remove ${member.name} from the roster database?\n\nTip: If they are simply not currently working shifts, click 'Mark Inactive' instead to preserve audit logs.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/roster?id=${encodeURIComponent(member.id)}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Deletion failed");
      }

      state.roster = state.roster.filter((m) => m.id !== member.id);
      updateStats();
      renderRoster();
      showToast(`${member.name} removed from roster.`, "success");
    } catch {
      showToast(`Failed to delete ${member.name}.`, "error");
    }
  }

  // --- Modal Management ---
  function openAddModal() {
    state.editingId = null;
    modalTitle.textContent = "Add Contact / Team Member";
    memberForm.reset();
    inputCategory.value = "Team Member";
    inputRole.value = "Cashier";
    inputActive.checked = true;
    memberModal.hidden = false;
    inputName.focus();
  }

  function openEditModal(member) {
    state.editingId = member.id;
    modalTitle.textContent = `Edit Details: ${member.name}`;
    inputCategory.value = member.category || "Team Member";
    inputName.value = member.name || "";
    inputLegalName.value = member.legalName || "";
    inputTmNumber.value = member.teamMemberNumber || "";
    inputPhone.value = member.phone || "";
    inputRole.value = member.role || "Cashier";
    inputNotes.value = member.notes || "";
    inputActive.checked = member.active !== false;
    memberModal.hidden = false;
    inputName.focus();
  }

  function closeModal() {
    memberModal.hidden = true;
    memberForm.reset();
    state.editingId = null;
  }

  async function handleModalSubmit(e) {
    e.preventDefault();
    const payload = {
      category: inputCategory.value,
      name: inputName.value.trim(),
      legalName: inputLegalName.value.trim(),
      teamMemberNumber: inputTmNumber.value.trim(),
      phone: inputPhone.value.trim(),
      role: inputRole.value,
      notes: inputNotes.value.trim(),
      active: inputActive.checked
    };

    if (!payload.name) {
      alert("Name is required.");
      return;
    }

    try {
      if (state.editingId) {
        // Edit existing
        const res = await fetch(`/api/admin/roster?id=${encodeURIComponent(state.editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to save changes");
        const data = await res.json();
        const idx = state.roster.findIndex((m) => m.id === state.editingId);
        if (idx !== -1) state.roster[idx] = data.member;
        showToast(`Updated ${payload.name} successfully.`, "success");
      } else {
        // Add new
        const res = await fetch("/api/admin/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to add team member");
        const data = await res.json();
        state.roster.push(data.member);
        showToast(`Added ${payload.name} to roster!`, "success");
      }

      closeModal();
      updateStats();
      renderRoster();
    } catch {
      showToast("Error saving roster entry. Check connection.", "error");
    }
  }

  // --- Phase 2: Onboarding & Split-Flow Functions ---
  function getOnboardingFormData() {
    const legalName = (document.getElementById("ob-legal-name")?.value || "").trim();
    const nameTag = (document.getElementById("ob-name-tag")?.value || "").trim();
    const role = document.getElementById("ob-role")?.value || "Cashier";
    const payRate = document.getElementById("ob-pay-rate")?.value || "13.73";
    const hireDate = document.getElementById("ob-hire-date")?.value || formatDateYmd(new Date());
    const pronouns = (document.getElementById("ob-pronouns")?.value || "").trim();
    const teamMemberNumber = (document.getElementById("ob-tm-number")?.value || "").trim();
    const targetHours = (document.getElementById("ob-target-hours")?.value || "").trim();

    const phone = (document.getElementById("ob-phone")?.value || "").trim();
    const email = (document.getElementById("ob-email")?.value || "").trim();
    const address = (document.getElementById("ob-address")?.value || "").trim();
    const emergencyContact = (document.getElementById("ob-emergency")?.value || "").trim();
    const dob = document.getElementById("ob-dob")?.value || "";
    const maritalStatus = document.getElementById("ob-marital")?.value || "Single";
    const dependents = document.getElementById("ob-dependents")?.value || "0";
    const shirtSize = document.getElementById("ob-shirt-size")?.value || "Medium";
    const textOk = document.getElementById("ob-text-ok")?.checked !== false;
    const minor = document.getElementById("ob-minor")?.checked === true;
    const availNotes = (document.getElementById("ob-avail-notes")?.value || "").trim();

    // Ephemeral fields
    const ssn = (document.getElementById("ob-ssn")?.value || "").trim();
    const depositType = document.getElementById("ob-deposit-type")?.value || "Direct Deposit";
    const accountType = document.getElementById("ob-account-type")?.value || "Checking";
    const bankName = (document.getElementById("ob-bank-name")?.value || "").trim();
    const routingNumber = (document.getElementById("ob-routing-number")?.value || "").trim();
    const accountNumber = (document.getElementById("ob-account-number")?.value || "").trim();

    // Checklists
    const chkI9 = document.getElementById("ob-chk-i9")?.checked !== false;
    const chkVoid = document.getElementById("ob-chk-void")?.checked !== false;
    const chkShirts = document.getElementById("ob-chk-shirts")?.checked !== false;
    const chkPos = document.getElementById("ob-chk-pos")?.checked === true;

    // Calculate age
    let age = "";
    if (dob) {
      const birthDate = new Date(dob);
      const hDate = new Date(hireDate || Date.now());
      let calculatedAge = hDate.getFullYear() - birthDate.getFullYear();
      const m = hDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && hDate.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      age = calculatedAge >= 0 ? String(calculatedAge) : "";
    }

    return {
      legalName,
      nameTag,
      role,
      payRate,
      hireDate,
      pronouns,
      teamMemberNumber,
      targetHours,
      phone,
      email,
      address,
      emergencyContact,
      dob,
      age,
      maritalStatus,
      dependents,
      shirtSize,
      textOk,
      minor,
      availNotes,
      ssn,
      depositType,
      accountType,
      bankName,
      routingNumber,
      accountNumber,
      chkI9,
      chkVoid,
      chkShirts,
      chkPos
    };
  }

  function purgeSensitiveData() {
    const ssnEl = document.getElementById("ob-ssn");
    const routingEl = document.getElementById("ob-routing-number");
    const acctEl = document.getElementById("ob-account-number");
    if (ssnEl) ssnEl.value = "";
    if (routingEl) routingEl.value = "";
    if (acctEl) acctEl.value = "";
  }

  function generateRobynExcel(data) {
    const wbData = [
      ["Pet Supplies Plus New Hire Information", ""],
      ["", ""],
      ["Store #:", "#212"],
      ["", ""],
      ["Legal Name:", data.legalName],
      ["", ""],
      ["Address:", data.address],
      ["", ""],
      ["", ""],
      ["Preferred pronouns:", data.pronouns || ""],
      ["Name tag Name:", data.nameTag],
      ["", ""],
      ["E-MAIL:", data.email],
      ["", ""],
      ["", ""],
      ["Date Of Birth:", data.dob || ""],
      ["", ""],
      ["Contact Phone #:", data.phone],
      ["OK to Text this #? ", data.textOk ? "Yes" : "No"],
      ["", ""],
      ["Emergency Contact (Name/Phone):", data.emergencyContact],
      ["", ""],
      ["Married/Single:", data.maritalStatus],
      ["", ""],
      ["", ""],
      ["HIRE DATE:", data.hireDate],
      ["Age at Hire", data.age || ""],
      ["Work Permit?", data.minor ? "Yes" : "N/A"],
      ["", ""],
      ["PAY RATE:", Number(data.payRate) || 13.73],
      ["Dependents #", Number(data.dependents) || 0],
      ["", ""],
      ["CONFIDENTIAL PAYROLL & DIRECT DEPOSIT", ""],
      ["SSN#:", data.ssn || ""],
      ["Payment Preference:", data.depositType],
      ["Bank / CU Name:", data.bankName || ""],
      ["Routing #:", data.routingNumber || ""],
      ["Account #:", data.accountNumber || ""],
      ["Account Type:", data.accountType],
      ["", ""],
      ["This form must be completed legibly. Please ensure all information is printed neatly.", ""],
      ["Students under the age of 18 must have a W-4/I-9 and a work permit from the school.", ""]
    ];

    const filename = `PSP_0212_NewHire_${(data.nameTag || "Employee").replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;

    if (window.XLSX && window.XLSX.utils) {
      try {
        const ws = window.XLSX.utils.aoa_to_sheet(wbData);
        ws["!cols"] = [{ wch: 35 }, { wch: 45 }];
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        window.XLSX.writeFile(wb, filename);
        return true;
      } catch (err) {
        console.warn("SheetJS write failed, falling back to SpreadsheetML", err);
      }
    }

    // Fallback: Excel XML SpreadsheetML format
    generateSpreadsheetML(wbData, filename.replace(/\.xlsx$/, ".xls"));
    return true;
  }

  function generateSpreadsheetML(rows, filename) {
    let xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>
 <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#007A2E"/></Style>
 <Style ss:ID="Label"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/></Style>
</Styles>
<Worksheet ss:Name="Sheet1">
<Table ss:DefaultColumnWidth="180">
`;
    rows.forEach((r, idx) => {
      xml += " <Row>\n";
      r.forEach((c, cIdx) => {
        const val = escapeXml(String(c || ""));
        const style = idx === 0 ? ' ss:StyleID="Header"' : cIdx === 0 && val ? ' ss:StyleID="Label"' : "";
        xml += `  <Cell${style}><Data ss:Type="String">${val}</Data></Cell>\n`;
      });
      xml += " </Row>\n";
    });
    xml += `</Table></Worksheet></Workbook>`;

    downloadBlob(xml, filename, "application/vnd.ms-excel;charset=utf-8;");
  }

  function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case '"': return "&quot;";
      }
      return c;
    });
  }

  function generateRobynEmailText(data) {
    return `To: robynmsu2@yahoo.com
CC: brandon.byron@gmail.com
Subject: New Hire Onboarding - Store #0212 - ${data.legalName} (${data.role})

Hi Robyn,

Please find the new hire onboarding details for Store #0212 (Battle Creek) below:

EMPLOYEE INFORMATION:
• Legal Name: ${data.legalName}
• Name Tag (Schedule Name): ${data.nameTag}
• Position / Role: ${data.role}
• Starting Wage: $${Number(data.payRate).toFixed(2)} / hr
• Hire Date: ${data.hireDate}
• Target Hours: ${data.targetHours || "Part-time (15-25 hrs/wk)"}
• Contact Phone #: ${data.phone} (Text OK: ${data.textOk ? "Yes" : "No"})
• E-MAIL: ${data.email}
• Address: ${data.address || "On file"}
• Preferred Pronouns: ${data.pronouns || "Not specified"}
• Date Of Birth: ${data.dob || "N/A"} (Age: ${data.age || "N/A"}${data.minor ? " - School Work Permit required" : ""})
• Married / Single: ${data.maritalStatus} | Dependents: ${data.dependents}
• Emergency Contact: ${data.emergencyContact || "N/A"}

CONFIDENTIAL PAYROLL & DIRECT DEPOSIT:
• SSN#: ${data.ssn || "[Provided on I-9 / attachment]"}
• Payment Preference: ${data.depositType}
• Bank / Credit Union: ${data.bankName || "N/A"}
• Routing #: ${data.routingNumber || "N/A"}
• Account #: ${data.accountNumber || "N/A"} (${data.accountType})

STORE ONBOARDING CHECKLIST:
[${data.chkI9 ? "X" : " "}] Form I-9 & Form W-4 Completed
[${data.chkVoid ? "X" : " "}] Direct Deposit Authorization / Voided Check
[${data.chkShirts ? "X" : " "}] Uniform Shirts Issued (Size: ${data.shirtSize})
[${data.chkPos ? "X" : " "}] D365 POS Register Login Requested

ATTACHMENT:
• PSP_0212_NewHire_${(data.nameTag || "Employee").replace(/[^a-zA-Z0-9]/g, "_")}.xlsx

Thank you!
Chris Brennan
Store Team Leader • Store #0212
Pet Supplies Plus Battle Creek
1791 W Columbia Ave, Battle Creek, MI 49015
Phone: 269-808-0491`;
  }

  async function saveOnboardingToRoster(data) {
    const payload = {
      category: "Team Member",
      name: data.nameTag,
      legalName: data.legalName !== data.nameTag ? data.legalName : "",
      teamMemberNumber: data.teamMemberNumber,
      phone: data.phone,
      email: data.email,
      role: data.role,
      notes: `Hired: ${data.hireDate} | $${Number(data.payRate).toFixed(2)}/hr | Target: ${data.targetHours || "15-25h"}${data.availNotes ? " | " + data.availNotes : ""}`,
      active: true
    };

    const res = await fetch("/api/admin/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error("Failed to save to master roster");
    }

    const resJson = await res.json();
    state.roster.push(resJson.member);
    updateStats();
    return resJson.member;
  }

  async function handleOnboardingSubmit(e) {
    if (e) e.preventDefault();
    const data = getOnboardingFormData();

    if (!data.legalName || !data.nameTag || !data.phone || !data.email) {
      alert("Please fill in Legal Name, Name Tag, Phone, and Email.");
      return;
    }

    try {
      // 1. Generate & download Robyn's Excel workbook
      generateRobynExcel(data);

      // 2. Generate notification email text
      const emailText = generateRobynEmailText(data);

      // 3. Save operational record to Master Roster API
      const savedMember = await saveOnboardingToRoster(data);

      // 4. Immediately purge sensitive SSN and banking fields from memory!
      purgeSensitiveData();

      // 5. Present result preview
      if (emailPreviewContent) emailPreviewContent.textContent = emailText;
      if (onboardingResultSummary) {
        onboardingResultSummary.textContent = `Downloaded Robyn's Excel form and added ${savedMember.name} (#${savedMember.teamMemberNumber || "Pending"}) to Store #0212 Master Roster. SSN and bank details have been purged from memory.`;
      }
      if (onboardingResultBox) onboardingResultBox.hidden = false;

      // Scroll to result preview
      onboardingResultBox.scrollIntoView({ behavior: "smooth" });
      showToast(`Onboarding completed! ${savedMember.name} added to roster.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Error processing onboarding. Check server connection.", "error");
    }
  }

  // --- Export Utilities ---
  function exportCsv() {
    const filtered = getFilteredRoster();
    if (!filtered.length) {
      showToast("No records to export in current filter.", "info");
      return;
    }

    const headers = ["Name", "Category", "Team Member # / Acct #", "Phone", "Role", "Active", "Legal Name / Company", "Notes"];
    const rows = filtered.map((m) => [
      `"${(m.name || "").replace(/"/g, '""')}"`,
      `"${(m.category || "Team Member").replace(/"/g, '""')}"`,
      `"${(m.teamMemberNumber || "").replace(/"/g, '""')}"`,
      `"${(m.phone || "").replace(/"/g, '""')}"`,
      `"${(m.role || "").replace(/"/g, '""')}"`,
      m.active ? "Yes" : "No",
      `"${(m.legalName || "").replace(/"/g, '""')}"`,
      `"${(m.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    downloadBlob(csvContent, `PSP_0212_Roster_${formatDateYmd(new Date())}.csv`, "text/csv;charset=utf-8;");
    showToast("Exported roster to CSV.", "success");
  }

  function exportJson() {
    const content = JSON.stringify(state.roster, null, 2);
    downloadBlob(content, `PSP_0212_Roster_${formatDateYmd(new Date())}.json`, "application/json");
    showToast("Exported full roster to JSON.", "success");
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Helpers
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sanitizeClass(str) {
    if (!str) return "default";
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, "-");
  }

  function formatDateYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Event Listeners
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (addMemberBtn) addMemberBtn.addEventListener("click", openAddModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (memberForm) memberForm.addEventListener("submit", handleModalSubmit);
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);
  if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportJson);
  if (refreshBtn) refreshBtn.addEventListener("click", loadRoster);

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderRoster();
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeTab = btn.getAttribute("data-roster-tab");

      if (state.activeTab === "onboarding") {
        if (rosterViewContainer) rosterViewContainer.hidden = true;
        if (onboardingViewContainer) onboardingViewContainer.hidden = false;
      } else {
        if (rosterViewContainer) rosterViewContainer.hidden = false;
        if (onboardingViewContainer) onboardingViewContainer.hidden = true;
        renderRoster();
      }
    });
  });

  // Onboarding Form Event Listeners
  if (onboardingForm) {
    onboardingForm.addEventListener("submit", handleOnboardingSubmit);
  }

  if (obHireDateInput && !obHireDateInput.value) {
    obHireDateInput.value = formatDateYmd(new Date());
  }

  if (obDobInput) {
    obDobInput.addEventListener("change", () => {
      const val = obDobInput.value;
      if (!val) return;
      const bDate = new Date(val);
      const today = new Date();
      let diffAge = today.getFullYear() - bDate.getFullYear();
      const m = today.getMonth() - bDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
        diffAge--;
      }
      if (obMinorCheckbox) {
        obMinorCheckbox.checked = diffAge < 18;
      }
    });
  }

  if (btnDownloadExcelOnly) {
    btnDownloadExcelOnly.addEventListener("click", () => {
      const data = getOnboardingFormData();
      if (!data.legalName || !data.nameTag) {
        alert("Please enter at least Legal Name and Name Tag to download form.");
        return;
      }
      generateRobynExcel(data);
      showToast("Downloaded Robyn's Excel form.", "success");
    });
  }

  if (btnCopyEmailOnly) {
    btnCopyEmailOnly.addEventListener("click", () => {
      const data = getOnboardingFormData();
      if (!data.legalName || !data.nameTag) {
        alert("Please enter employee details first.");
        return;
      }
      const text = generateRobynEmailText(data);
      navigator.clipboard.writeText(text).then(() => {
        showToast("Copied Robyn notification email to clipboard!", "success");
      }).catch(() => {
        showToast("Error copying to clipboard.", "error");
      });
    });
  }

  if (btnResetOnboarding) {
    btnResetOnboarding.addEventListener("click", () => {
      if (confirm("Reset new hire onboarding form?")) {
        onboardingForm.reset();
        purgeSensitiveData();
        if (obHireDateInput) obHireDateInput.value = formatDateYmd(new Date());
        if (onboardingResultBox) onboardingResultBox.hidden = true;
        showToast("Onboarding form reset.", "info");
      }
    });
  }

  if (btnCopyGeneratedEmail) {
    btnCopyGeneratedEmail.addEventListener("click", () => {
      const content = emailPreviewContent ? emailPreviewContent.textContent : "";
      if (!content) return;
      navigator.clipboard.writeText(content).then(() => {
        showToast("Email text copied to clipboard!", "success");
      }).catch(() => {
        showToast("Error copying to clipboard.", "error");
      });
    });
  }

  if (btnOpenEmailClient) {
    btnOpenEmailClient.addEventListener("click", () => {
      const data = getOnboardingFormData();
      const subject = encodeURIComponent(`New Hire Onboarding - Store #0212 - ${data.legalName || data.nameTag} (${data.role})`);
      const body = encodeURIComponent(emailPreviewContent ? emailPreviewContent.textContent : generateRobynEmailText(data));
      const mailtoUrl = `mailto:robynmsu2@yahoo.com?cc=brandon.byron@gmail.com&subject=${subject}&body=${body}`;
      window.open(mailtoUrl, "_blank");
    });
  }

  if (btnBackToRoster) {
    btnBackToRoster.addEventListener("click", () => {
      const activeTabBtn = document.querySelector('[data-roster-tab="active"]');
      if (activeTabBtn) activeTabBtn.click();
    });
  }

  if (inputCategory) {
    inputCategory.addEventListener("change", () => {
      const cat = inputCategory.value;
      if (cat === "Facility Support") {
        inputRole.value = "Facility Support";
      } else if (cat === "Vendors") {
        inputRole.value = "Vendor";
      } else if (cat === "Horn Group" || cat === "PSP Corporate") {
        inputRole.value = "Corporate";
      } else if (cat === "Sister Store") {
        inputRole.value = "Sister Store";
      } else if (cat === "Team Member") {
        inputRole.value = "Cashier";
      }
    });
  }

  // Close modal when clicking on backdrop
  if (memberModal) {
    memberModal.addEventListener("click", (e) => {
      if (e.target === memberModal) {
        closeModal();
      }
    });
  }

  // Initialize
  checkSession();
})();
