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
  const statTotalStaff = document.getElementById("stat-total-staff");
  const statDirectoryCount = document.getElementById("stat-directory-count");

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
    const directory = state.roster.filter((m) => m.category && m.category !== "Team Member");

    if (statActiveCount) statActiveCount.textContent = activeStaff.length;
    if (statInactiveCount) statInactiveCount.textContent = inactiveStaff.length;
    if (statTotalStaff) statTotalStaff.textContent = teamMembers.length;
    if (statDirectoryCount) statDirectoryCount.textContent = directory.length;
  }

  function getFilteredRoster() {
    const q = state.searchQuery.toLowerCase().trim();
    return state.roster.filter((item) => {
      const isTeam = item.category === "Team Member" || !item.category;
      const isDirectory = !isTeam;

      // Tab matching
      if (state.activeTab === "active" && (!isTeam || !item.active)) return false;
      if (state.activeTab === "inactive" && (!isTeam || item.active)) return false;
      if (state.activeTab === "directory" && !isDirectory) return false;
      if (state.activeTab === "all" && !isTeam) return false;

      // Search matching
      if (q) {
        const nameMatch = (item.name || "").toLowerCase().includes(q);
        const legalMatch = (item.legalName || "").toLowerCase().includes(q);
        const phoneMatch = (item.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
        const roleMatch = (item.role || "").toLowerCase().includes(q);
        const notesMatch = (item.notes || "").toLowerCase().includes(q);
        const tmNumMatch = String(item.teamMemberNumber || "").toLowerCase().includes(q);
        if (!nameMatch && !legalMatch && !phoneMatch && !roleMatch && !notesMatch && !tmNumMatch) {
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
    modalTitle.textContent = "Add Team Member";
    memberForm.reset();
    inputCategory.value = "Team Member";
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
    inputRole.value = member.role || "Cashier Team Member";
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

  // --- Export Utilities ---
  function exportCsv() {
    const filtered = getFilteredRoster();
    if (!filtered.length) {
      showToast("No records to export in current filter.", "info");
      return;
    }

    const headers = ["Name", "Team Member #", "Phone", "Role", "Active", "Legal Name", "Notes"];
    const rows = filtered.map((m) => [
      `"${(m.name || "").replace(/"/g, '""')}"`,
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
      renderRoster();
    });
  });

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
