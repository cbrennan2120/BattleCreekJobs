const DEFAULT_STORE_CONFIG = {
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
  level2InviteSubjectTemplate: "{{storeName}} - Next Step (Full Application)",
  level2InviteBodyTemplate: `Hi {{firstName}},

Thank you for your interest in joining Pet Supplies Plus Battle Creek!

We reviewed your initial availability and pay expectations for the {{position}} role and would like to invite you to complete Step 2 of our hiring process (employment history, references, and background details):

{{level2Url}}

Once you submit your full details, we will review them and reach out to schedule an in-person interview.

Thank you,
{{senderName}}
{{senderTitle}}
{{storeName}}`,
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

const STORAGE_KEYS = {
  failedSubmissions: "psp-hiring-hub-failed-submissions"
};
const NETLIFY_FORM_NAME = "battle-creek-application";
const ADMIN_API_BASE = "/api/admin";

const STEP_DEFS = [
  { id: "basic", label: "Start", caption: "Basic details" },
  { id: "availability", label: "Availability", caption: "Schedule fit" },
  { id: "pay", label: "Pay", caption: "Starting pay" },
  { id: "fit", label: "About you", caption: "Retail readiness" },
  { id: "review", label: "Submit", caption: "Final review" }
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHIFTS = [
  { id: "morning", label: "Day Shift", hours: "9a - 5p" },
  { id: "afternoon", label: "Mid Shift", hours: "11a - 7p" },
  { id: "evening", label: "Closing Shift", hours: "5p - 9p" }
];

const STAGES = ["new", "sent_step2", "full_completed", "interview", "hold", "declined", "hired"];
const STAGE_LABELS = {
  new: "New (Level 1)",
  sent_step2: "Sent Step 2 Invite",
  full_completed: "Level 2 Completed",
  interview: "Interviewing",
  hold: "Hold",
  declined: "Declined",
  hired: "Hired"
};
const LEGACY_DEFAULT_ADMIN_CODE = "battlecreek-manager";

let storeConfig = { ...DEFAULT_STORE_CONFIG };
const formState = createInitialFormState();
let currentStep = 0;
let applicants = [];
let selectedApplicantId = null;

const progressRail = document.getElementById("progress-rail");
const stepEyebrow = document.getElementById("step-eyebrow");
const stepTitle = document.getElementById("step-title");
const stepContent = document.getElementById("step-content");
const fitPreview = document.getElementById("fit-preview");
const nextStepButton = document.getElementById("next-step");
const prevStepButton = document.getElementById("prev-step");
const resetButton = document.getElementById("reset-form");
const managerBuckets = document.getElementById("manager-buckets");
const candidateList = document.getElementById("candidate-list");
const candidateDetail = document.getElementById("candidate-detail");
const applicantCount = document.getElementById("applicant-count");
const seedDemoDataButton = document.getElementById("seed-demo-data");
const exportCsvButton = document.getElementById("export-csv");
const exportJsonButton = document.getElementById("export-json");
const settingsForm = document.getElementById("settings-form");
const saveSettingsButton = document.getElementById("save-settings-button");
const candidateSearch = document.getElementById("candidate-search");
const stageFilter = document.getElementById("stage-filter");
const bucketFilter = document.getElementById("bucket-filter");
const submissionBanner = document.getElementById("submission-banner");
const startNewApplicationButton = document.getElementById("start-new-application");
const adminGateShell = document.getElementById("admin-gate-shell");
const adminLoginForm = document.getElementById("admin-login-form");
const adminAccessCodeInput = document.getElementById("admin-access-code");
const adminGateNote = document.getElementById("admin-gate-note");
const adminLogoutButton = document.getElementById("admin-logout");
const exportFailedSubmissionsButton = document.getElementById("export-failed-submissions");
const clearFailedSubmissionsButton = document.getElementById("clear-failed-submissions");
const adminTabButtons = Array.from(document.querySelectorAll("[data-admin-tab]"));
const adminTabPanels = Array.from(document.querySelectorAll("[data-admin-panel]"));
const healthTabAlert = document.getElementById("health-tab-alert");
const hasApplicantPage = !!document.getElementById("application-form");
const hasManagerPage = !!document.getElementById("manager-dashboard");
let failedSubmissions = loadFailedSubmissions();
const adminState = {
  authenticated: false,
  sessionChecked: false,
  loading: false,
  loadError: "",
  health: null,
  readOnlyReason: "",
  configLoading: false,
  activeTab: "applicants"
};
const managerFilters = {
  search: "",
  stage: "all",
  bucket: "all"
};

initialize();

function initialize() {
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-jump");
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  syncStoreBranding();
  loadStoreConfig();

  if (hasApplicantPage) {
    document.getElementById("application-form").addEventListener("submit", (event) => {
      event.preventDefault();
    });
    nextStepButton.addEventListener("click", handleNextStep);
    prevStepButton.addEventListener("click", handlePreviousStep);
    resetButton.addEventListener("click", () => resetForm(true));
    startNewApplicationButton.addEventListener("click", () => {
      hideSubmissionBanner();
      resetForm(false);
      document.getElementById("application")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    hideSubmissionBanner();
    renderProgressRail();
    renderStep();
  }

  if (hasManagerPage) {
    adminLoginForm.addEventListener("submit", handleAdminLogin);
    adminLogoutButton.addEventListener("click", handleAdminLogout);
    adminTabButtons.forEach((button) => {
      button.addEventListener("click", () => setAdminTab(button.dataset.adminTab));
    });
    exportFailedSubmissionsButton.addEventListener("click", exportFailedSubmissions);
    clearFailedSubmissionsButton.addEventListener("click", clearFailedSubmissions);
    exportCsvButton.addEventListener("click", exportApplicantsCsv);
    exportJsonButton.addEventListener("click", exportApplicantsJson);
    saveSettingsButton.addEventListener("click", saveSettingsFromForm);
    candidateSearch.addEventListener("input", () => {
      managerFilters.search = candidateSearch.value.trim().toLowerCase();
      renderDashboard();
    });
    stageFilter.addEventListener("change", () => {
      managerFilters.stage = stageFilter.value;
      renderDashboard();
    });
    bucketFilter.addEventListener("change", () => {
      managerFilters.bucket = bucketFilter.value;
      renderDashboard();
    });

    hydrateSettingsForm();
    if (seedDemoDataButton) {
      seedDemoDataButton.hidden = true;
    }
    setAdminTab(adminState.activeTab);
    applyAdminAccessState();
  }
}

function setAdminTab(tabName) {
  if (!tabName) return;
  adminState.activeTab = tabName;
  adminTabButtons.forEach((button) => {
    const isActive = button.dataset.adminTab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  adminTabPanels.forEach((panel) => {
    const isActive = panel.dataset.adminPanel === tabName;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
}

function createInitialFormState() {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    ageBand: "",
    authorized: "",
    experienceLevel: "first_job",
    position: "Stock Team Member",
    hoursWanted: "20-29",
    startDate: "",
    minimumHoursNeeded: "",
    payComfort: "",
    canLift: "",
    enjoysRetail: "",
    whyWorkHere: "",
    serviceExample: "",
    availability: createBlankAvailability()
  };
}

function createBlankAvailability() {
  return DAYS.reduce((days, day) => {
    days[day] = SHIFTS.reduce((shifts, shift) => {
      shifts[shift.id] = false;
      return shifts;
    }, {});
    return days;
  }, {});
}

function renderProgressRail() {
  if (!progressRail) return;
  progressRail.innerHTML = STEP_DEFS.map((step, index) => {
    const stateClass = index < currentStep ? "complete" : index === currentStep ? "active" : "";
    return `
      <li class="progress-step ${stateClass}">
        <div class="progress-node">${index + 1}</div>
        <div class="progress-label">${step.label}</div>
        <div class="progress-caption">${step.caption}</div>
      </li>
    `;
  }).join("");
}

function renderStep() {
  if (!hasApplicantPage) return;
  const step = STEP_DEFS[currentStep];
  stepEyebrow.textContent = `Step ${currentStep + 1}`;
  stepTitle.textContent = step.label === "Start" ? "Basic Information" : step.label;
  fitPreview.textContent = previewFitState();
  prevStepButton.style.visibility = currentStep === 0 ? "hidden" : "visible";
  nextStepButton.textContent = currentStep === STEP_DEFS.length - 1 ? "Submit Application" : "Continue";
  nextStepButton.classList.toggle("button-large", step.id === "review");

  switch (step.id) {
    case "basic":
      stepContent.innerHTML = renderBasicStep();
      break;
    case "availability":
      stepContent.innerHTML = renderAvailabilityStep();
      break;
    case "pay":
      stepContent.innerHTML = renderPayStep();
      break;
    case "fit":
      stepContent.innerHTML = renderFitStep();
      break;
    case "review":
      stepContent.innerHTML = renderReviewStep();
      break;
    default:
      stepContent.innerHTML = "";
  }

  bindStepInputs();
  renderProgressRail();
}

function renderBasicStep() {
  return `
    <div class="field-grid">
      <div class="field">
        <label for="firstName">First name</label>
        <input id="firstName" name="firstName" value="${escapeHtml(formState.firstName)}" required>
      </div>
      <div class="field">
        <label for="lastName">Last name</label>
        <input id="lastName" name="lastName" value="${escapeHtml(formState.lastName)}" required>
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value="${escapeHtml(formState.email)}" required>
      </div>
      <div class="field">
        <label for="phone">Mobile phone</label>
        <input id="phone" name="phone" value="${escapeHtml(formState.phone)}" required>
      </div>
      <div class="field" style="grid-column: 1 / -1;">
        <label for="city">City / Hometown</label>
        <input id="city" name="city" placeholder="e.g. Battle Creek, Springfield, Portage" value="${escapeHtml(formState.city)}" required>
      </div>
    </div>
    <div class="field" style="margin-top: 14px;">
      <label for="position">Position of interest</label>
      <select id="position" name="position">
        ${renderOptions(["Stock Team Member", "Cashier Team Member"], formState.position)}
      </select>
      <div class="helper-banner role-helper" style="margin-top: 8px;">${renderRoleSummary(formState.position)}</div>
    </div>
    <div class="step-section">
      <div class="section-callout">
        <h4>Work Experience</h4>
        <p>First job? Student? Retail pro? We welcome and train dependable candidates of all backgrounds.</p>
      </div>
      <div class="experience-grid">
        <label class="experience-card ${formState.experienceLevel === "first_job" ? "is-active" : ""}" for="exp-first-job">
          <input id="exp-first-job" type="radio" name="experienceLevel" value="first_job" ${formState.experienceLevel === "first_job" ? "checked" : ""}>
          <h4>🌱 First Job / Student</h4>
          <p>No formal work history yet? That is completely fine! We love training eager, dependable team members.</p>
        </label>
        <label class="experience-card ${formState.experienceLevel === "some_experience" ? "is-active" : ""}" for="exp-some-exp">
          <input id="exp-some-exp" type="radio" name="experienceLevel" value="some_experience" ${formState.experienceLevel === "some_experience" ? "checked" : ""}>
          <h4>⭐ 1–2 Years Experience</h4>
          <p>You have worked a part-time, seasonal, food service, or customer-facing role before.</p>
        </label>
        <label class="experience-card ${formState.experienceLevel === "experienced" ? "is-active" : ""}" for="exp-experienced">
          <input id="exp-experienced" type="radio" name="experienceLevel" value="experienced" ${formState.experienceLevel === "experienced" ? "checked" : ""}>
          <h4>🏆 3+ Years Experience</h4>
          <p>Experienced retail associate, cashier, stocker, or customer service background.</p>
        </label>
      </div>
    </div>
    <div class="step-section">
      <div class="section-callout">
        <h4>Age</h4>
        <p>Select one option below.</p>
      </div>
      <div class="choice-grid">
        <div class="choice-card">
          <input id="ageBand-18plus" type="radio" name="ageBand" value="18+" ${formState.ageBand === "18+" ? "checked" : ""}>
          <label for="ageBand-18plus">
            <h4>I am at least 18 years old</h4>
            <p>Preferred for open availability and standard retail scheduling.</p>
          </label>
        </div>
        <div class="choice-card">
          <input id="ageBand-under18" type="radio" name="ageBand" value="16-17" ${formState.ageBand === "16-17" ? "checked" : ""}>
          <label for="ageBand-under18">
            <h4>I am 16-17 years old</h4>
            <p>Still eligible to apply; schedule options follow student/minor work rules.</p>
          </label>
        </div>
      </div>
    </div>
    <div class="step-section">
      <div class="section-callout">
        <h4>Work authorization</h4>
        <p>Select one option below.</p>
      </div>
      <div class="choice-grid">
        <div class="choice-card">
          <input id="authorized-yes" type="radio" name="authorized" value="yes" ${formState.authorized === "yes" ? "checked" : ""}>
          <label for="authorized-yes">
            <h4>I am legally authorized to work in the U.S.</h4>
            <p>This is required before a job offer can be made.</p>
          </label>
        </div>
        <div class="choice-card">
          <input id="authorized-no" type="radio" name="authorized" value="no" ${formState.authorized === "no" ? "checked" : ""}>
          <label for="authorized-no">
            <h4>I am not currently authorized to work in the U.S.</h4>
            <p>This application will be marked for follow-up review.</p>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderRoleSummary(position) {
  const summaries = {
    "Stock Team Member": "Stock Team Members help keep the store full, clean, and easy to shop. This role includes stocking shelves, organizing products, helping with customer carry-outs, handling 50 lb. bags of pet food, and supporting general retail tasks throughout the store.",
    "Cashier Team Member": "Cashier Team Members run the front register, help neighbors, support store cleanliness, and help care for our small animals, reptiles, amphibians, and arachnids."
  };

  return summaries[position] || "Choose the role that best matches how you like to work in the store.";
}

function renderAvailabilityStep() {
  return `
    <div class="helper-banner">We ask about schedule early so you can see whether this opening matches the hours you want. Saturday and Sunday coverage is required for retail store operations; evenings are preferred.</div>
    <div class="field-grid triple">
      <div class="field">
        <label for="hoursWanted">How many hours per week are you seeking?</label>
        <select id="hoursWanted" name="hoursWanted">
          ${renderOptions(["10-19", "20-29", "30-39", "40+"], formState.hoursWanted)}
        </select>
      </div>
      <div class="field">
        <label for="minimumHoursNeeded">Minimum hours needed each week</label>
        <input id="minimumHoursNeeded" name="minimumHoursNeeded" type="number" min="1" max="40" value="${escapeHtml(formState.minimumHoursNeeded)}" placeholder="Example: 12">
      </div>
      <div class="field">
        <label for="startDate">When can you start?</label>
        <input id="startDate" name="startDate" type="date" value="${escapeHtml(formState.startDate)}">
      </div>
    </div>
    <div class="field">
      <p class="grid-label">Weekly availability (Tap any shift to toggle)</p>
      <div class="shift-presets">
        <button class="preset-btn" type="button" data-preset="weekends">📅 All Weekends (Sat & Sun)</button>
        <button class="preset-btn" type="button" data-preset="closing_weekends">🌙 Evenings & Weekends</button>
        <button class="preset-btn" type="button" data-preset="all">✨ Open Availability</button>
        <button class="preset-btn" type="button" data-preset="clear">Clear All</button>
      </div>
      <table class="availability-table">
        <thead>
          <tr>
            <th>Shift</th>
            ${DAYS.map((day) => `<th>${day.slice(0, 3)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${SHIFTS.map((shift) => `
            <tr>
              <td>${shift.label}<br><small>${shift.hours}</small></td>
              ${DAYS.map((day) => {
                const checked = Boolean(formState.availability?.[day]?.[shift.id]);
                return `
                  <td>
                    <label class="shift-tap-cell ${checked ? "is-checked" : ""}" title="${day} ${shift.label}">
                      <input
                        type="checkbox"
                        data-day="${day}"
                        data-shift="${shift.id}"
                        ${checked ? "checked" : ""}
                      >
                      <span>${checked ? "✓ Available" : "Off"}</span>
                    </label>
                  </td>
                `;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="availability-note">For this opening, we need ${availabilityRequirementText()}. Weekday shifts are 9-5, 11-7, or 5-9. Sunday hours are 10-6.</p>
    </div>
  `;
}

function renderPayStep() {
  return `
    <div class="reality-check-card">
      <div class="reality-check-heading">
        <p class="eyebrow">Compensation & Growth</p>
        <h3>Pet Supplies Plus Battle Creek Starting Pay</h3>
      </div>
      <p style="margin: 0; color: var(--text);">We share our pay and growth schedule early so you have full clarity before taking the time to interview.</p>
      <div class="reality-check-grid">
        <div class="reality-item">
          <strong>$${Number(storeConfig.payMin).toFixed(2)} / hr</strong>
          <p>Starting base rate (Michigan minimum wage starting rate).</p>
        </div>
        <div class="reality-item">
          <strong>Raises Twice A Year</strong>
          <p>Eligible for biannual reviews with raises up to 5% based on reliability & performance.</p>
        </div>
        <div class="reality-item">
          <strong>Part-Time (${storeConfig.minimumHoursNeeded}-${storeConfig.maximumHoursOffered} hrs)</strong>
          <p>Flexible store schedule; weekend availability required for team coverage.</p>
        </div>
      </div>
    </div>
    <div class="field">
      <label>Does this starting pay and schedule work for you?</label>
      <div class="choice-grid">
        <label class="choice-card" for="payComfort-yes">
          <input id="payComfort-yes" type="radio" name="payComfort" value="yes" ${formState.payComfort === "yes" ? "checked" : ""}>
          <span>
            <h4>Yes, this starting pay and schedule work for me</h4>
            <p>I understand the starting rate is $${Number(storeConfig.payMin).toFixed(2)}/hr with biannual reviews and raises up to 5%.</p>
          </span>
        </label>
        <label class="choice-card" for="payComfort-no">
          <input id="payComfort-no" type="radio" name="payComfort" value="no" ${formState.payComfort === "no" ? "checked" : ""}>
          <span>
            <h4>No, I would need a higher starting rate</h4>
            <p>We respect your time and want to be 100% transparent about store compensation.</p>
          </span>
        </label>
      </div>
    </div>
  `;
}

function renderFitStep() {
  const roleLead = {
    "Stock Team Member": "Passion for pets. Plus the roll-up-your-sleeves work. Stock Team Members keep the store full, clean, and organized through stocking, product merchandising, carry-outs, handling 50 lb bags of pet food, cleaning, ladders, and retail support.",
    "Cashier Team Member": "Passion for pets. Plus the roll-up-your-sleeves work. Cashier Team Members run checkout, welcome neighbors, answer questions, maintain front-end cleanliness, and help care for small animals, reptiles, and fish."
  }[formState.position] || "Passion for pets. Plus the roll-up-your-sleeves work. This role mixes helping neighbors with register work, stocking, cleaning, lifting, and keeping the pet center running smoothly.";

  return `
    <div class="helper-banner">${escapeHtml(roleLead)}</div>
    <div class="step-section">
      <div class="section-callout">
        <h4>Physical and store duties</h4>
        <p>Select one option below.</p>
      </div>
      <div class="choice-grid">
        <label class="choice-card" for="canLift-yes">
          <input id="canLift-yes" type="radio" name="canLift" value="yes" ${formState.canLift === "yes" ? "checked" : ""}>
          <span>
            <h4>I am comfortable with lifting, stocking, cleaning, being on my feet, handling heavy pet food bags (up to 50 lbs), and climbing ladders.</h4>
            <p>This includes handling pet food bags, helping neighbors with carry-outs, and supporting day-to-day store duties.</p>
          </span>
        </label>
        <label class="choice-card" for="canLift-no">
          <input id="canLift-no" type="radio" name="canLift" value="no" ${formState.canLift === "no" ? "checked" : ""}>
          <span>
            <h4>Those duties would be difficult for me.</h4>
            <p>We ask this up front so both sides are clear on essential job requirements.</p>
          </span>
        </label>
      </div>
    </div>
    <div class="step-section">
      <div class="section-callout">
        <h4>Retail expectations</h4>
        <p>Select one option below.</p>
      </div>
      <div class="choice-grid">
        <label class="choice-card" for="enjoysRetail-yes">
          <input id="enjoysRetail-yes" type="radio" name="enjoysRetail" value="yes" ${formState.enjoysRetail === "yes" ? "checked" : ""}>
          <span>
            <h4>I understand this is a retail role, not only an animal handling role.</h4>
            <p>The job includes customer service, register checkout, stocking shelves, and completing store tasks throughout each shift.</p>
          </span>
        </label>
        <label class="choice-card" for="enjoysRetail-no">
          <input id="enjoysRetail-no" type="radio" name="enjoysRetail" value="no" ${formState.enjoysRetail === "no" ? "checked" : ""}>
          <span>
            <h4>I am mainly looking for a role focused only on animals.</h4>
            <p>That helps us understand whether this store role lines up with what you are hoping for.</p>
          </span>
        </label>
      </div>
    </div>
    <div class="field">
      <label for="whyWorkHere">Why would you like to work at ${escapeHtml(storeConfig.name)}?</label>
      <textarea id="whyWorkHere" name="whyWorkHere" placeholder="Tell us what draws you to pets, our neighbors, or joining our store team.">${escapeHtml(formState.whyWorkHere)}</textarea>
    </div>
    <div class="field">
      <label for="serviceExample">Tell us about a time you helped someone, worked hard on a team, or stayed dependable.</label>
      <textarea id="serviceExample" name="serviceExample" placeholder="Can be from a previous job, school, sport, club, volunteer work, or helping family/neighbors.">${escapeHtml(formState.serviceExample)}</textarea>
    </div>
  `;
}

function renderReviewStep() {
  const expLabel = {
    first_job: "🌱 First Job / Student",
    some_experience: "⭐ 1–2 Years Experience",
    experienced: "🏆 3+ Years Experience"
  }[formState.experienceLevel] || "🌱 First Job / Student";

  return `
    <div class="review-box">
      <strong>Final application review</strong>
      <ul>
        <li>Role selected: ${escapeHtml(formState.position || "Not selected")}</li>
        <li>Experience track: ${escapeHtml(expLabel)}</li>
        <li>Hours wanted: ${escapeHtml(formState.hoursWanted || "Not set")} (Min ${escapeHtml(formState.minimumHoursNeeded || "?")} hrs/wk)</li>
        <li>Starting pay ($13.73/hr + biannual raises): ${formState.payComfort === "yes" ? "Confirmed" : formState.payComfort === "no" ? "Needs higher starting rate" : "Not confirmed"}</li>
      </ul>
    </div>
    <div class="field-grid">
      <div class="field">
        <label>Applicant</label>
        <div class="helper-banner">${escapeHtml(`${formState.firstName} ${formState.lastName}`.trim() || "Name not entered yet")}</div>
      </div>
      <div class="field">
        <label>Position & Experience</label>
        <div class="helper-banner">${escapeHtml(formState.position || "Not selected")} &bull; ${escapeHtml(expLabel)}</div>
      </div>
    </div>
    <div class="field">
      <label>Schedule & Wage Summary</label>
      <div class="helper-banner">
        ${escapeHtml(`${formState.hoursWanted || "Hours not set"} desired (minimum ${formState.minimumHoursNeeded || "?"} hrs/wk), starting pay $${Number(storeConfig.payMin).toFixed(2)}/hr ${formState.payComfort === "yes" ? "confirmed" : "not accepted"}`)}
      </div>
    </div>
    <div class="field checkbox-row checkbox-row-emphasis">
      <input id="confirm-submit" type="checkbox">
      <label for="confirm-submit">I confirm the information above is accurate and ready to submit to Pet Supplies Plus Battle Creek.</label>
    </div>
  `;
}

function bindStepInputs() {
  // Preset buttons
  stepContent.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (preset === "all") {
        setAllAvailability(true);
      } else if (preset === "clear") {
        setAllAvailability(false);
      } else if (preset === "weekends") {
        DAYS.forEach((day) => {
          const isWeekend = day === "Saturday" || day === "Sunday";
          SHIFTS.forEach((shift) => {
            formState.availability[day][shift.id] = isWeekend;
          });
        });
      } else if (preset === "closing_weekends") {
        DAYS.forEach((day) => {
          const isWeekend = day === "Saturday" || day === "Sunday";
          SHIFTS.forEach((shift) => {
            formState.availability[day][shift.id] = isWeekend || shift.id === "evening";
          });
        });
      }
      renderStep();
    });
  });

  stepContent.querySelectorAll("input, select, textarea").forEach((element) => {
    if (element.type === "checkbox" && element.dataset.day && element.dataset.shift) {
      element.addEventListener("change", () => {
        formState.availability[element.dataset.day][element.dataset.shift] = element.checked;
        const tapLabel = element.closest("label.shift-tap-cell");
        if (tapLabel) {
          tapLabel.classList.toggle("is-checked", element.checked);
          const span = tapLabel.querySelector("span");
          if (span) span.textContent = element.checked ? "✓ Available" : "Off";
        }
        fitPreview.textContent = previewFitState();
      });
      return;
    }

    const syncValue = () => {
      if (element.type === "radio") {
        formState[element.name] = element.value;
        if (element.name === "experienceLevel") {
          stepContent.querySelectorAll(".experience-card").forEach((card) => {
            const input = card.querySelector('input[name="experienceLevel"]');
            card.classList.toggle("is-active", input?.checked);
          });
        }
      } else if (element.type !== "checkbox") {
        formState[element.name] = element.value;
      }
      if (element.name === "position") {
        const roleHelper = stepContent.querySelector(".role-helper");
        if (roleHelper) roleHelper.textContent = renderRoleSummary(formState.position);
      }
      fitPreview.textContent = previewFitState();
    };

    element.addEventListener("input", syncValue);
    element.addEventListener("change", syncValue);
  });
}

async function handleNextStep() {
  if (!validateStep()) {
    return;
  }

  if (currentStep === STEP_DEFS.length - 1) {
    await submitApplication();
    return;
  }

  currentStep += 1;
  renderStep();
}

function handlePreviousStep() {
  if (currentStep === 0) return;
  currentStep -= 1;
  renderStep();
}

function validateStep() {
  const stepId = STEP_DEFS[currentStep].id;

  if (stepId === "basic") {
    const required = ["firstName", "lastName", "email", "phone", "city", "ageBand", "authorized"];
    if (required.some((field) => !String(formState[field]).trim())) {
      window.alert("Complete the basic contact details before continuing.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(formState.email).trim())) {
      window.alert("Please enter a valid email address (e.g. name@example.com).");
      return false;
    }
    const cleanPhone = String(formState.phone).replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      window.alert("Please enter a valid 10-digit mobile phone number.");
      return false;
    }
  }

  if (stepId === "availability") {
    if (!formState.minimumHoursNeeded || countSelectedAvailability(formState.availability) === 0) {
      window.alert("Add the minimum hours needed and at least one availability slot before continuing.");
      return false;
    }
  }

  if (stepId === "pay") {
    if (!formState.payComfort) {
      window.alert("Confirm whether the starting pay works for you before continuing.");
      return false;
    }
  }

  if (stepId === "fit") {
    const required = ["canLift", "enjoysRetail", "whyWorkHere", "serviceExample"];
    if (required.some((field) => !String(formState[field]).trim())) {
      window.alert("Answer the job-fit questions before continuing.");
      return false;
    }
  }

  if (stepId === "review") {
    if (!document.getElementById("confirm-submit")?.checked) {
      window.alert("Check the confirmation box before submitting.");
      return false;
    }
  }

  return true;
}

function previewFitState() {
  if (currentStep === 0) return "Getting started";
  if (currentStep === 1) return "Schedule details";
  if (currentStep === 2) return "Compensation";
  if (currentStep === 3) return "Role fit";
  if (currentStep === 4) return "Ready to review";
  return "In progress";
}

async function submitApplication() {
  if (nextStepButton) {
    if (nextStepButton.disabled) return;
    nextStepButton.disabled = true;
    nextStepButton.textContent = "Submitting application...";
  }

  try {
    const scored = scoreApplication(formState);
    const applicant = {
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      stage: "new",
      managerNote: "",
      fullName: `${formState.firstName} ${formState.lastName}`.trim(),
      email: formState.email,
      phone: formState.phone,
      city: formState.city,
      experienceLevel: formState.experienceLevel || "first_job",
      position: formState.position,
      ageBand: formState.ageBand,
      authorized: formState.authorized,
      hoursWanted: formState.hoursWanted,
      minimumHoursNeeded: Number(formState.minimumHoursNeeded),
      startDate: formState.startDate,
      expectedPay: formState.payComfort === "yes" ? Number(storeConfig.payMax) : Number(storeConfig.payMax) + 0.01,
      payComfort: formState.payComfort,
      canLift: formState.canLift,
      enjoysRetail: formState.enjoysRetail,
      whyWorkHere: formState.whyWorkHere.trim(),
      serviceExample: formState.serviceExample.trim(),
      availability: structuredClone(formState.availability),
      ...scored
    };

    await submitLiveApplication(applicant);
    const submittedId = applicant.id;
    resetForm(false);
    showSubmissionBanner(submittedId);
    document.getElementById("application")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Submission failed:", err);
    window.alert("There was a temporary network issue submitting your application. Please try again.");
    if (nextStepButton) {
      nextStepButton.disabled = false;
      nextStepButton.textContent = "Submit Application";
    }
  }
}

function scoreApplication(candidate) {
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

function getAvailabilityStats(availability) {
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

function getBucket(score, flags) {
  if (flags.includes("core-duties-mismatch") || flags.includes("pay-out-of-range")) return "review";
  if (score >= 78) return "top";
  if (score >= 62) return "strong";
  if (score >= 45) return "maybe";
  return "review";
}

function bucketToLabel(bucket) {
  return {
    top: "Top Match",
    strong: "Strong Match",
    maybe: "Maybe",
    review: "Needs Review"
  }[bucket] || "Needs Review";
}

function buildRecommendation(bucket, flags) {
  if (bucket === "top") return "Invite to interview now.";
  if (bucket === "strong") return "Review quickly and invite if weekend coverage and weekly hours still line up.";
  if (flags.includes("pay-out-of-range")) return "Decline unless the role budget changes.";
  if (flags.includes("weekend-missing") || flags.includes("evening-missing")) return "Keep as backup only if the store schedule opens up.";
  return "Manager review needed before next step.";
}

function renderDashboard() {
  if (!hasManagerPage) return;
  const filteredApplicants = getFilteredApplicants();
  if (!adminState.loading) {
    if (filteredApplicants.length) {
      if (!filteredApplicants.some((candidate) => candidate.id === selectedApplicantId)) {
        selectedApplicantId = filteredApplicants[0].id;
      }
    } else if (applicants.length) {
      selectedApplicantId = null;
    }
  }
  const interviewReadyCount = applicants.filter((candidate) => candidate.bucket === "top" || candidate.bucket === "strong").length;
  const counts = {
    top: applicants.filter((candidate) => candidate.bucket === "top").length,
    strong: applicants.filter((candidate) => candidate.bucket === "strong").length,
    maybe: applicants.filter((candidate) => candidate.bucket === "maybe").length,
    review: applicants.filter((candidate) => candidate.bucket === "review").length
  };

  managerBuckets.innerHTML = `
    ${renderBucket("Top Match", "Interview first", counts.top)}
    ${renderBucket("Strong Match", "Good fallback pool", counts.strong)}
    ${renderBucket("Maybe", "Needs manager judgment", counts.maybe)}
    ${renderBucket("Needs Review", "Likely mismatch", counts.review)}
  `;

  applicantCount.textContent = `${filteredApplicants.length} shown / ${applicants.length} total`;

  if (adminState.loading) {
      candidateList.innerHTML = `<div class="empty-state"><div><h3>Loading applicants</h3><p>Pulling the latest applications and shared manager review state.</p></div></div>`;
  } else if (adminState.loadError) {
    candidateList.innerHTML = `<div class="empty-state"><div><h3>Applicant data could not be loaded</h3><p>${escapeHtml(adminState.loadError)}</p></div></div>`;
  } else if (filteredApplicants.length) {
    candidateList.innerHTML = filteredApplicants.map(renderCandidateItem).join("");
  } else if (applicants.length) {
    candidateList.innerHTML = `<div class="empty-state"><div><h3>No applicants match this filter</h3><p>Try clearing the search or changing the stage and fit filters.</p></div></div>`;
  } else {
    candidateList.innerHTML = `<div class="empty-state"><div><h3>No real applicants yet</h3><p>New submissions will appear here after they are received through the live Netlify form.</p></div></div>`;
  }

  candidateList.querySelectorAll(".candidate-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectedApplicantId = button.dataset.id;
      renderDashboard();
    });
  });

  const capacityNote = document.getElementById("interview-capacity-note");
  if (capacityNote) {
    capacityNote.textContent = `${interviewReadyCount} interview-ready applicants. Weekly booking capacity is 4 interviews.`;
  }

  const submissionHealthNote = document.getElementById("submission-health-note");
  if (submissionHealthNote) {
    if (adminState.health) {
      const intakeReachable = adminState.health.intakeReachable ?? adminState.health.formsReachable;
      if (!intakeReachable) {
        submissionHealthNote.textContent = "Live application intake could not be reached. Applicant review is blocked.";
      } else if (!adminState.health.storageReachable) {
        submissionHealthNote.textContent = "Shared manager review storage could not be reached. Review is read-only.";
      } else {
        submissionHealthNote.textContent = adminState.health.unresolvedSaveFailures
          ? `${adminState.health.unresolvedSaveFailures} shared review save issue(s) need follow-up.`
          : "Live intake and shared manager review storage are reachable.";
      }
    } else {
      submissionHealthNote.textContent = "Submission health has not loaded yet.";
    }
  }

  const queue = document.getElementById("submission-queue");
  if (queue) {
    queue.innerHTML = failedSubmissions.length
      ? failedSubmissions.map((item) => `
          <article class="submission-queue-item">
            <h4>${escapeHtml(item.fullName || "Unknown applicant")}</h4>
            <p>Submitted: ${escapeHtml(formatDate(item.submittedAt || new Date().toISOString()))}</p>
            <p>Reason: ${escapeHtml(item.reason || "Unknown failure")}</p>
          </article>
        `).join("")
      : `<div class="helper-banner">No failed live submissions are currently queued.</div>`;
  }

  renderHealthTabAlert();

  renderSelectedApplicant(filteredApplicants);
}

function renderHealthTabAlert() {
  if (!healthTabAlert) return;
  const intakeReachable = adminState.health?.intakeReachable ?? adminState.health?.formsReachable ?? true;
  const hasHealthIssue = adminState.health && (!intakeReachable || !adminState.health.storageReachable || Boolean(adminState.health.unresolvedSaveFailures));
  const hasLocalFailures = failedSubmissions.length > 0;
  const shouldShow = Boolean(hasHealthIssue || hasLocalFailures);
  healthTabAlert.hidden = !shouldShow;
}

function getFilteredApplicants() {
  return applicants.filter((candidate) => {
    const matchesSearch = !managerFilters.search || [
      candidate.fullName,
      candidate.city,
      candidate.position
    ].some((value) => String(value).toLowerCase().includes(managerFilters.search));

    const matchesStage = managerFilters.stage === "all" || candidate.stage === managerFilters.stage;
    const matchesBucket = managerFilters.bucket === "all" || candidate.bucket === managerFilters.bucket;

    return matchesSearch && matchesStage && matchesBucket;
  });
}

function renderBucket(title, caption, count) {
  return `
    <article class="bucket">
      <h3>${title}</h3>
      <p>${caption}</p>
      <strong>${count}</strong>
    </article>
  `;
}

function renderCandidateItem(candidate) {
  const activeClass = candidate.id === selectedApplicantId ? "active" : "";
  const isLevel2Ready = Boolean(candidate.level2 || candidate.stage === "full_completed");
  const level2Class = isLevel2Ready ? "level2-ready" : "";
  return `
    <button type="button" class="candidate-item ${activeClass} ${level2Class}" data-id="${candidate.id}">
      <div class="candidate-item-top">
        <div>
          <h4>${escapeHtml(candidate.fullName)}</h4>
          <p>${escapeHtml(candidate.position)} | ${escapeHtml(candidate.city)}</p>
        </div>
        <div class="candidate-score">${candidate.score}</div>
      </div>
      <div class="candidate-meta">
        <span>${candidate.bucketLabel}</span>
        <span>${candidate.availabilityPercent}% availability overlap</span>
      </div>
      <div class="tag-row">
        ${isLevel2Ready ? `<span class="tag" style="background: var(--green-soft); color: var(--green-deep); font-weight: 700; border: 1px solid var(--green);">✓ Level 2 Ready</span>` : ""}
        ${candidate.stage === "sent_step2" ? `<span class="tag" style="background: #EDE7F6; color: #512DA8; font-weight: 700; border: 1px solid #B39DDB;">✉ Step 2 Sent</span>` : ""}
        ${candidate.experienceLevel === "first_job" ? `<span class="tag" style="background: #FFF8E1; color: #8D6E63;">🌱 First Job</span>` : ""}
        <span class="tag ${candidate.payFitLabel === "Out of range" ? "alert" : ""}">${candidate.payFitLabel}</span>
        <span class="tag ${candidate.flags.includes("weekend-missing") ? "warn" : ""}">${candidate.flags.includes("weekend-missing") ? "Weekend gap" : "Weekend ready"}</span>
        <span class="tag neutral-stage">${STAGE_LABELS[candidate.stage] || "New"}</span>
      </div>
    </button>
  `;
}

function renderLevel2Section(candidate) {
  const l2 = candidate.level2;

  if (!l2) {
    return `
      <section class="detail-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4>Step 2: Background & Reliability Application</h4>
          <span class="status-pill neutral" style="font-size: 11px;">Not Completed Yet</span>
        </div>
        <div class="template-box" style="background: var(--bg-soft); border-left: 4px solid var(--amber);">
          <p style="margin: 0 0 10px; font-weight: 600;">The candidate has completed the Level 1 Quick Screen. You can send them their personalized Step 2 link:</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="button button-secondary" type="button" id="copy-level2-link-sec">Copy Step 2 Link</button>
            <button class="button button-secondary" type="button" id="copy-level2-msg-sec">Copy Step 2 Invite Message</button>
          </div>
        </div>
      </section>
    `;
  }

  const isFirstJob = l2.experienceTrack === "first_job";
  const petsList = Array.isArray(l2.petsOwned) ? l2.petsOwned.join(", ") : (l2.petsOwned || "None listed");

  return `
    <section class="detail-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4>Step 2: Background & Reliability Application</h4>
        <span class="status-pill" style="background: var(--green-soft); color: var(--green-deep); border: 1px solid var(--green); font-size: 11px;">✓ Completed</span>
      </div>

      <div class="field-group" style="background: var(--bg-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 12px;">
        <strong style="color: var(--green-deep); display: block; margin-bottom: 6px;">Education & Experience Track</strong>
        <p style="margin: 0 0 8px; font-size: 14px;"><strong>Education:</strong> ${escapeHtml(l2.lastGradeCompleted || "N/A")} &bull; <strong>School:</strong> ${escapeHtml(l2.schoolName || "N/A")}</p>
        <p style="margin: 0; font-size: 14px;"><strong>Track:</strong> ${isFirstJob ? "🌱 First-Time Job / Student (No prior employer)" : "💼 Prior Work Experience"}</p>
      </div>

      ${isFirstJob ? `
        <div class="field-group" style="background: var(--bg-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 12px;">
          <strong style="color: var(--green-deep); display: block; margin-bottom: 6px;">First-Job Profile</strong>
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600;">Activities, Volunteering & Responsibilities:</p>
          <p class="inline-quote" style="margin: 0 0 10px; font-style: italic; font-size: 13px;">${escapeHtml(l2.firstJobActivities || "None listed")}</p>
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600;">What they are excited to learn:</p>
          <p class="inline-quote" style="margin: 0; font-style: italic; font-size: 13px;">${escapeHtml(l2.firstJobExcitement || "None listed")}</p>
        </div>
      ` : `
        <div class="field-group" style="background: var(--bg-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 12px;">
          <strong style="color: var(--green-deep); display: block; margin-bottom: 6px;">Employer Work History</strong>
          <p style="margin: 0 0 4px; font-size: 14px;"><strong>Company:</strong> ${escapeHtml(l2.emp1Company || "N/A")} | <strong>Role:</strong> ${escapeHtml(l2.emp1Position || "N/A")} (${escapeHtml(l2.emp1Dates || "N/A")})</p>
          <p style="margin: 0 0 4px; font-size: 13px;"><strong>Reason for Leaving:</strong> ${escapeHtml(l2.emp1Reason || "N/A")}</p>
          <p style="margin: 0; font-size: 13px;"><strong>Duties:</strong> ${escapeHtml(l2.emp1Duties || "N/A")}</p>
          ${l2.emp2Company ? `
            <hr style="border: 0; border-top: 1px dashed var(--line); margin: 8px 0;">
            <p style="margin: 0 0 4px; font-size: 14px;"><strong>Previous:</strong> ${escapeHtml(l2.emp2Company)} | <strong>Role:</strong> ${escapeHtml(l2.emp2Position || "N/A")} (${escapeHtml(l2.emp2Dates || "N/A")})</p>
            <p style="margin: 0; font-size: 13px;"><strong>Reason for Leaving:</strong> ${escapeHtml(l2.emp2Reason || "N/A")}</p>
          ` : ""}
        </div>
      `}

      <div class="field-group" style="background: var(--bg-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 12px;">
        <strong style="color: var(--green-deep); display: block; margin-bottom: 6px;">References</strong>
        <p style="margin: 0 0 6px; font-size: 13px;"><strong>1. ${escapeHtml(l2.ref1Name || "N/A")}</strong> (${escapeHtml(l2.ref1Rel || "N/A")}) &mdash; <a href="tel:${escapeHtml(l2.ref1Phone || "")}">${escapeHtml(l2.ref1Phone || "No phone")}</a></p>
        <p style="margin: 0; font-size: 13px;"><strong>2. ${escapeHtml(l2.ref2Name || "N/A")}</strong> (${escapeHtml(l2.ref2Rel || "N/A")}) &mdash; <a href="tel:${escapeHtml(l2.ref2Phone || "")}">${escapeHtml(l2.ref2Phone || "No phone")}</a></p>
      </div>

      <div class="field-group" style="background: var(--bg-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 12px;">
        <strong style="color: var(--green-deep); display: block; margin-bottom: 6px;">Pet Familiarity & Attendance Philosophy</strong>
        <p style="margin: 0 0 6px; font-size: 13px;"><strong>Pets Owned/Cared For:</strong> ${escapeHtml(petsList)}</p>
        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600;">Attendance Philosophy:</p>
        <p class="inline-quote" style="margin: 0 0 8px; font-style: italic; font-size: 13px;">${escapeHtml(l2.excellentAttendance || "N/A")}</p>
        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600;">Curiosity / Self-Taught Example:</p>
        <p class="inline-quote" style="margin: 0; font-style: italic; font-size: 13px;">${escapeHtml(l2.selfTaught || "N/A")}</p>
      </div>

      <div class="field-group" style="background: var(--bg-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
        <strong style="color: var(--green-deep); display: block; margin-bottom: 6px;">Store Duties & Digital Signature</strong>
        <p style="margin: 0 0 4px; font-size: 13px;"><strong>50 lbs Lifting & Ladders:</strong> ${l2.physicalRequirements === "Yes" ? "✅ Yes, comfortable with essential duties" : "⚠️ Difficulty noted"}</p>
        <p style="margin: 0 0 4px; font-size: 13px;"><strong>First 90 Days Success Strategy:</strong> ${escapeHtml(l2.first90Days || "N/A")}</p>
        <p style="margin: 0; font-size: 13px;"><strong>Signed by:</strong> ${escapeHtml(l2.applicantSignature || candidate.fullName)} on ${escapeHtml(l2.signatureDate || "N/A")}</p>
      </div>
    </section>
  `;
}

function renderSelectedApplicant(filteredApplicants = applicants) {
  const candidate = filteredApplicants.find((entry) => entry.id === selectedApplicantId);

  if (!candidate) {
    candidateDetail.className = "candidate-detail empty-state";
    candidateDetail.innerHTML = `
      <div>
        <h3>No applicant selected</h3>
        <p>${adminState.loadError ? escapeHtml(adminState.loadError) : "Select an applicant from the shared review list to inspect details."}</p>
      </div>
    `;
    return;
  }

  candidateDetail.className = "candidate-detail";
  candidateDetail.innerHTML = `
    <div class="detail-stack">
      <div class="detail-header">
        <div>
          <h3>${escapeHtml(candidate.fullName)}</h3>
          <p>${escapeHtml(candidate.position)} | Applied ${formatDate(candidate.submittedAt)}</p>
        </div>
        <span class="status-pill ${candidate.bucket === "review" ? "neutral" : ""}">${candidate.bucketLabel}</span>
      </div>

      <div class="detail-metric-row">
        <article class="detail-metric">
          <span>Candidate score</span>
          <strong>${candidate.score}/100</strong>
          <p>${candidate.bucketLabel}</p>
        </article>
        <article class="detail-metric">
          <span>Availability fit</span>
          <strong>${candidate.availabilityPercent}%</strong>
          <p>${candidate.flags.includes("weekend-missing") ? "Weekend follow-up needed" : "Good coverage for current needs"}</p>
        </article>
        <article class="detail-metric">
          <span>Pay fit</span>
          <strong>${escapeHtml(candidate.payFitLabel)}</strong>
          <p>Expected $${Number(candidate.expectedPay || storeConfig.payMin || 13.73).toFixed(2)} / hr</p>
        </article>
      </div>

      <section class="detail-section">
        <h4>Recommended next action</h4>
        <div class="helper-banner">${escapeHtml(candidate.recommendation)}</div>
      </section>

      <div class="detail-actions">
        <div class="field compact-field">
          <label for="candidate-stage">Pipeline stage</label>
          <select id="candidate-stage">
            ${STAGES.map((stage) => `<option value="${stage}" ${candidate.stage === stage ? "selected" : ""}>${STAGE_LABELS[stage]}</option>`).join("")}
          </select>
        </div>
        <button class="button button-secondary" type="button" id="mark-interviewing">Mark Interviewing</button>
        <button class="button button-secondary" type="button" id="mark-declined">Mark Declined</button>
        <button class="button button-danger" type="button" id="delete-candidate">Delete Candidate</button>
      </div>

      <section class="detail-section">
        <h4>Key details (Level 1 Screen)</h4>
        <ul class="detail-list">
          <li>Role applied for: <strong>${escapeHtml(candidate.position)}</strong></li>
          <li>Email: ${escapeHtml(candidate.email)}</li>
          <li>Phone: ${escapeHtml(candidate.phone || "Not provided")}</li>
          <li>Starting pay expectation: $${Number(candidate.expectedPay || storeConfig.payMin || 13.73).toFixed(2)} / hr (Base rate $13.73/hr)</li>
          <li>Experience profile: ${candidate.experienceLevel === "first_job" ? "🌱 First-Time Job / Student" : "💼 Experienced Candidate"}</li>
          <li>Hours wanted: ${escapeHtml(candidate.hoursWanted)} (Minimum weekly needed: ${candidate.minimumHoursNeeded || 12} hrs)</li>
          <li>Employment type: ${escapeHtml(storeConfig.employmentType || "Part-time (12-35 hrs/wk)")}</li>
          <li>Start date: ${escapeHtml(candidate.startDate || "Flexible / Immediate")}</li>
          <li>Authorized to work: ${candidate.authorized === "yes" ? "Yes" : "Needs review"}</li>
          <li>Core physical duties (50 lbs / ladders): ${candidate.canLift === "yes" ? "Yes, comfortable" : "Needs accommodation"}</li>
          <li>Interview location: ${escapeHtml(storeConfig.interviewLocation || DEFAULT_STORE_CONFIG.interviewLocation)}</li>
        </ul>
      </section>

      ${renderLevel2Section(candidate)}

      <section class="detail-section">
        <h4>Submitted availability (Level 1 Screen)</h4>
        <div class="availability-detail-list">
          ${renderCandidateAvailability(candidate.availability)}
        </div>
      </section>

      <section class="detail-section">
        <h4>Manager notes</h4>
        <div class="template-box">
          <p>${adminState.readOnlyReason ? escapeHtml(adminState.readOnlyReason) : "Notes and pipeline stage are shared across manager sessions."}</p>
          <textarea id="manager-note" ${adminState.readOnlyReason ? "disabled" : ""}>${escapeHtml(candidate.managerNote || "")}</textarea>
          <div class="form-actions">
            <button class="button button-secondary" type="button" id="save-note" ${adminState.readOnlyReason ? "disabled" : ""}>Save note</button>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h4>Screening notes & flags</h4>
        <div class="detail-notes">
          ${candidate.notes.length ? candidate.notes.map((note) => `<p>| ${escapeHtml(note)}</p>`).join("") : "<p>No risk flags triggered. Candidate is aligned with the current screen.</p>"}
        </div>
      </section>

      <section class="detail-section">
        <h4>Level 1 short answers</h4>
        <ul class="detail-list">
          <li>Why Pet Supplies Plus: ${escapeHtml(candidate.whyWorkHere)}</li>
          <li>Customer service example: ${escapeHtml(candidate.serviceExample)}</li>
        </ul>
      </section>

      <section class="detail-section">
        <h4>Email & scheduling actions</h4>
        <div class="template-box compact-template-actions">
          <p>1-click actions to contact the candidate via Outlook or default mail client, copy templates, and book interviews.</p>
          <div class="form-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="button button-primary" type="button" id="open-level2-email" style="background: var(--blue); border-color: var(--blue);">Send Step 2 Invite via Outlook</button>
            <button class="button button-primary" type="button" id="open-invite-email" style="background: var(--green); border-color: var(--green);">Send Interview Invite via Outlook</button>
            <button class="button button-secondary" type="button" id="open-calendar-link">Book on Google Calendar</button>
            <button class="button button-secondary" type="button" id="print-scorecard">Print Interview Scorecard</button>
            <button class="button button-secondary" type="button" id="copy-level2-message">Copy Step 2 Message</button>
            <button class="button button-secondary" type="button" id="copy-level2-link">Copy Step 2 Link</button>
            <button class="button button-secondary" type="button" id="copy-invite-message">Copy Interview Message</button>
            <button class="button button-secondary" type="button" id="open-decline-email">Send Decline Email via Outlook</button>
            <button class="button button-secondary" type="button" id="copy-decline-message">Copy Decline Message</button>
          </div>
        </div>
      </section>
    </div>
  `;

  const level2Url = `${window.location.origin}/level2.html?id=${encodeURIComponent(candidate.id)}&name=${encodeURIComponent(candidate.fullName)}&email=${encodeURIComponent(candidate.email || "")}&phone=${encodeURIComponent(candidate.phone || "")}`;

  document.getElementById("candidate-stage")?.addEventListener("change", async (event) => updateCandidate(selectedApplicantId, { stage: event.target.value, lastAction: "stage-change" }));
  document.getElementById("mark-interviewing")?.addEventListener("click", async () => updateCandidate(selectedApplicantId, { stage: "interview", lastAction: "mark-interviewing" }));
  document.getElementById("mark-declined")?.addEventListener("click", async () => updateCandidate(selectedApplicantId, { stage: "declined", lastAction: "mark-declined" }));
  document.getElementById("delete-candidate")?.addEventListener("click", async () => deleteCandidate(selectedApplicantId, candidate.fullName));
  document.getElementById("open-calendar-link")?.addEventListener("click", () => window.open(storeConfig.schedulingLink || DEFAULT_STORE_CONFIG.schedulingLink, "_blank"));
  document.getElementById("open-level2-email")?.addEventListener("click", async () => {
    openMailto(buildMailtoLink(candidate.email, buildLevel2InviteSubject(candidate), buildLevel2InviteMessage(candidate)));
    if (candidate.stage === "new") {
      await updateCandidate(selectedApplicantId, { stage: "sent_step2", lastAction: "sent-step2-invite" });
    }
  });
  document.getElementById("copy-invite-message")?.addEventListener("click", () => copyTextToClipboard(buildInviteMessage(candidate)));
  document.getElementById("copy-level2-link")?.addEventListener("click", () => copyTextToClipboard(level2Url));
  document.getElementById("copy-level2-message")?.addEventListener("click", () => copyTextToClipboard(buildLevel2InviteMessage(candidate)));
  document.getElementById("copy-level2-link-sec")?.addEventListener("click", () => copyTextToClipboard(level2Url));
  document.getElementById("copy-level2-msg-sec")?.addEventListener("click", () => copyTextToClipboard(buildLevel2InviteMessage(candidate)));
  document.getElementById("open-decline-email")?.addEventListener("click", () => openMailto(buildMailtoLink(candidate.email, buildDeclineSubject(candidate), buildDeclineMessage(candidate))));
  document.getElementById("copy-decline-message")?.addEventListener("click", () => copyTextToClipboard(buildDeclineMessage(candidate)));
  document.getElementById("save-note")?.addEventListener("click", async () => {
    const managerNote = document.getElementById("manager-note")?.value ?? "";
    await updateCandidate(selectedApplicantId, { managerNote, lastAction: "save-note" });
    window.alert("Manager note saved.");
  });
}

function printCandidateScorecard(candidate) {
  let printArea = document.getElementById("print-scorecard-area");
  if (!printArea) {
    printArea = document.createElement("div");
    printArea.id = "print-scorecard-area";
    document.body.appendChild(printArea);
  }

  const l2 = candidate.level2 || {};
  const isFirstJob = l2.experienceTrack === "first_job" || candidate.experienceLevel === "first_job";
  const petsText = Array.isArray(l2.petsOwned) ? l2.petsOwned.join(", ") : (l2.petsOwned || "None listed");

  printArea.innerHTML = `
    <div class="scorecard-container">
      <div class="scorecard-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00AF41; padding-bottom: 10px;">
          <div>
            <h1 style="margin: 0; font-size: 18pt; color: #00AF41; font-weight: 800;">PET SUPPLIES PLUS &bull; BATTLE CREEK</h1>
            <p style="margin: 2px 0 0; font-size: 10pt; color: #444;">Store #0212 &bull; 1791 W. Columbia Ave &bull; (269) 964-9252</p>
          </div>
          <div style="text-align: right;">
            <strong style="font-size: 12pt; display: block;">Interview Evaluation Scorecard</strong>
            <span style="font-size: 9pt; color: #666;">Date: _________________ &bull; Interviewer: _________________</span>
          </div>
        </div>
      </div>

      <div class="scorecard-section" style="margin-top: 12px; background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
          <tr>
            <td style="width: 50%;"><strong>Candidate:</strong> ${escapeHtml(candidate.fullName)}</td>
            <td style="width: 50%;"><strong>Role Applied:</strong> ${escapeHtml(candidate.position)}</td>
          </tr>
          <tr>
            <td><strong>Phone:</strong> ${escapeHtml(candidate.phone || "N/A")} &bull; <strong>Email:</strong> ${escapeHtml(candidate.email)}</td>
            <td><strong>Starting Pay Confirmed:</strong> $13.73 / hr &bull; <strong>Weekly Hours:</strong> ${escapeHtml(candidate.hoursWanted || "12-35")}</td>
          </tr>
          <tr>
            <td><strong>Track:</strong> ${isFirstJob ? "🌱 First-Time Job / Student" : "💼 Prior Work Experience"}</td>
            <td><strong>School / Ed:</strong> ${escapeHtml(l2.lastGradeCompleted || "N/A")} (${escapeHtml(l2.schoolName || "N/A")})</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Past Employer / Activities:</strong> ${escapeHtml(isFirstJob ? (l2.firstJobActivities || "None listed") : `${l2.emp1Company || "N/A"} - ${l2.emp1Position || "N/A"} (${l2.emp1Dates || "N/A"})`)}</td>
          </tr>
          <tr>
            <td><strong>References:</strong> 1. ${escapeHtml(l2.ref1Name || "N/A")} (${escapeHtml(l2.ref1Phone || "N/A")}) &bull; 2. ${escapeHtml(l2.ref2Name || "N/A")} (${escapeHtml(l2.ref2Phone || "N/A")})</td>
            <td><strong>Pets Owned/Cared:</strong> ${escapeHtml(petsText)}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Attendance Philosophy:</strong> "${escapeHtml(l2.excellentAttendance || candidate.whyWorkHere || "N/A")}"</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 12px;">
        <h4 style="margin: 0 0 6px; font-size: 11pt; color: #00AF41; text-transform: uppercase; letter-spacing: 0.5px;">Paw Print Values & Competency Rubric</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #ccc;">
          <thead>
            <tr style="background: #eef7ee; border-bottom: 1px solid #ccc; text-align: left;">
              <th style="padding: 6px; width: 35%;">Category & Core Standard</th>
              <th style="padding: 6px; width: 25%; text-align: center;">Evaluation (1 = Weak, 5 = Excellent)</th>
              <th style="padding: 6px; width: 40%;">Interviewer Observations / Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">
                <strong>1. Dependability & Punctuality</strong><br>
                <span style="font-size: 8pt; color: #555;">Arrived on time, reliable transportation, weekend & evening commitment.</span>
              </td>
              <td style="padding: 6px; text-align: center;">
                <span style="font-size: 10pt; font-family: monospace;">1 &bull; 2 &bull; 3 &bull; 4 &bull; 5</span>
              </td>
              <td style="padding: 6px;"></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">
                <strong>2. Neighborly Hospitality</strong><br>
                <span style="font-size: 8pt; color: #555;">Warm eye contact, approachable smile, enthusiastic customer service mindset.</span>
              </td>
              <td style="padding: 6px; text-align: center;">
                <span style="font-size: 10pt; font-family: monospace;">1 &bull; 2 &bull; 3 &bull; 4 &bull; 5</span>
              </td>
              <td style="padding: 6px;"></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">
                <strong>3. Physical Duties & Stamina</strong><br>
                <span style="font-size: 8pt; color: #555;">Comfortable with 50 lb dog food bags, carry-outs, rolling safety ladders, cleaning.</span>
              </td>
              <td style="padding: 6px; text-align: center;">
                <span style="font-size: 10pt; font-family: monospace;">1 &bull; 2 &bull; 3 &bull; 4 &bull; 5</span>
              </td>
              <td style="padding: 6px;"></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px;">
                <strong>4. Pet-Centric Curiosity & Learning</strong><br>
                <span style="font-size: 8pt; color: #555;">Genuine affection for animals, curiosity to learn pet diets and product lines.</span>
              </td>
              <td style="padding: 6px; text-align: center;">
                <span style="font-size: 10pt; font-family: monospace;">1 &bull; 2 &bull; 3 &bull; 4 &bull; 5</span>
              </td>
              <td style="padding: 6px;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 10px; border: 1px solid #ccc; padding: 8px; border-radius: 4px; min-height: 48px;">
        <strong style="font-size: 9pt; display: block; margin-bottom: 2px;">Key Strengths / Follow-up Notes:</strong>
      </div>

      <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #00AF41; padding-top: 8px;">
        <div>
          <strong style="font-size: 9.5pt;">Store #0212 Hiring Recommendation:</strong><br>
          <span style="font-size: 9pt;">
            [ &nbsp; ] <strong>HIRE</strong> (Offer $13.73/hr) &nbsp;&nbsp;&nbsp;&nbsp;
            [ &nbsp; ] <strong>HOLD / BACKUP</strong> &nbsp;&nbsp;&nbsp;&nbsp;
            [ &nbsp; ] <strong>DECLINE</strong>
          </span>
        </div>
        <div style="text-align: right; font-size: 9pt;">
          <span>STL Signature: ___________________________ Date: _________</span>
        </div>
      </div>
    </div>
  `;

  document.body.classList.add("is-printing-scorecard");
  window.print();
  window.setTimeout(() => {
    document.body.classList.remove("is-printing-scorecard");
  }, 1000);
}

async function updateCandidate(id, patch) {
  if (adminState.readOnlyReason) {
    window.alert(adminState.readOnlyReason);
    return;
  }

  try {
    const response = await fetchJson(`${ADMIN_API_BASE}/applicants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });

    if (response.status === 401) {
      adminGateNote.textContent = "Your manager session expired. Sign in again.";
      await handleSessionExpired();
      return;
    }

    if (!response.ok) {
      const details = await safeParseJson(response);
      throw new Error(details?.error || "Unable to save manager review state.");
    }

    await loadAdminData({ preserveSelection: true, preferredSelectionId: id });
  } catch (error) {
    window.alert(String(error.message || error));
  }
}

async function deleteCandidate(id, fullName) {
  if (!id) return;
  const confirmed = window.confirm(`Delete ${fullName} from the hiring dashboard? This permanently removes the candidate record.`);
  if (!confirmed) return;

  try {
    const response = await fetchJson(`${ADMIN_API_BASE}/applicants/${id}`, {
      method: "DELETE"
    });

    if (response.status === 401) {
      adminGateNote.textContent = "Your manager session expired. Sign in again.";
      await handleSessionExpired();
      return;
    }

    if (!response.ok) {
      const details = await safeParseJson(response);
      throw new Error(details?.error || "Unable to delete candidate.");
    }

    await loadAdminData({ preserveSelection: false });
    window.alert("Candidate deleted.");
  } catch (error) {
    window.alert(String(error.message || error));
  }
}

function buildLevel2InviteSubject(candidate) {
  return renderMessageTemplate(storeConfig.level2InviteSubjectTemplate || DEFAULT_STORE_CONFIG.level2InviteSubjectTemplate, candidate);
}

function buildLevel2InviteMessage(candidate) {
  return renderMessageTemplate(storeConfig.level2InviteBodyTemplate || DEFAULT_STORE_CONFIG.level2InviteBodyTemplate, candidate);
}

function buildInviteSubject(candidate) {
  return renderMessageTemplate(storeConfig.inviteSubjectTemplate || DEFAULT_STORE_CONFIG.inviteSubjectTemplate, candidate);
}

function buildInviteMessage(candidate) {
  return renderMessageTemplate(storeConfig.inviteBodyTemplate || DEFAULT_STORE_CONFIG.inviteBodyTemplate, candidate);
}

function buildDeclineSubject(candidate) {
  return renderMessageTemplate(storeConfig.declineSubjectTemplate || DEFAULT_STORE_CONFIG.declineSubjectTemplate, candidate);
}

function buildDeclineMessage(candidate) {
  return renderMessageTemplate(storeConfig.declineBodyTemplate || DEFAULT_STORE_CONFIG.declineBodyTemplate, candidate);
}

function getCandidateFirstName(candidate) {
  return String(candidate?.fullName || "").trim().split(/\s+/)[0] || "there";
}

function getTemplateContext(candidate) {
  const level2Url = `${window.location.origin}/level2.html?id=${encodeURIComponent(candidate?.id || "")}&name=${encodeURIComponent(candidate?.fullName || "")}&email=${encodeURIComponent(candidate?.email || "")}&phone=${encodeURIComponent(candidate?.phone || "")}`;
  return {
    firstName: getCandidateFirstName(candidate),
    fullName: candidate?.fullName || "",
    position: candidate?.position || "Store Team Member",
    level2Url,
    storeName: storeConfig.name || DEFAULT_STORE_CONFIG.name,
    payRate: `$${Number(storeConfig.payMin || DEFAULT_STORE_CONFIG.payMin).toFixed(2)}`,
    availabilityRequirement: availabilityRequirementText(),
    schedulingLink: storeConfig.schedulingLink || DEFAULT_STORE_CONFIG.schedulingLink,
    interviewLocation: storeConfig.interviewLocation || DEFAULT_STORE_CONFIG.interviewLocation,
    interviewWindow: storeConfig.interviewWindow || DEFAULT_STORE_CONFIG.interviewWindow,
    senderName: storeConfig.senderName || DEFAULT_STORE_CONFIG.senderName,
    senderTitle: storeConfig.senderTitle || DEFAULT_STORE_CONFIG.senderTitle,
    legalName: storeConfig.legalName || DEFAULT_STORE_CONFIG.legalName
  };
}

function renderMessageTemplate(template, candidate) {
  const context = getTemplateContext(candidate);
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(context, key) ? context[key] : match;
  });
}

function buildMailtoLink(email, subject, body) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function openMailto(link) {
  window.location.href = link;
}

function renderCandidateAvailability(availability) {
  return SHIFTS.map((shift) => {
    const selectedDays = DAYS.filter((day) => availability?.[day]?.[shift.id]);
    const shiftHours = shift.id === "morning" ? "9-5" : shift.id === "afternoon" ? "11-7" : "5-9";
    const label = `${shift.label} (${shiftHours})`;
    return `
      <article class="availability-detail-item">
        <h5>${escapeHtml(label)}</h5>
        <p>${escapeHtml(selectedDays.length ? selectedDays.join(", ") : "None selected")}</p>
      </article>
    `;
  }).join("");
}

function copyTemplate(id) {
  const field = document.getElementById(id);
  const text = field?.value;
  if (!text) return;
  copyTextToClipboard(text, field);
}

function copyTextToClipboard(text, sourceField) {
  const fallbackCopy = () => {
    const field = sourceField || document.createElement("textarea");
    const temporaryField = !sourceField;
    try {
      if (temporaryField) {
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.top = "-9999px";
        field.style.left = "-9999px";
        document.body.appendChild(field);
      }
      field.focus();
      field.select();
      field.setSelectionRange(0, text.length);
      const copied = document.execCommand("copy");
      if (copied) {
        window.alert("Template copied to clipboard.");
      } else {
        window.alert("Clipboard access is blocked. The template text is selected so you can copy it manually.");
      }
    } catch {
      window.alert("Clipboard access is blocked. Open the email and copy the message manually.");
    } finally {
      if (temporaryField) field.remove();
    }
  };

  if (!navigator.clipboard?.writeText) {
    fallbackCopy();
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => window.alert("Template copied to clipboard."))
    .catch(() => fallbackCopy());
}

function resetForm(showAlert) {
  Object.assign(formState, createInitialFormState());
  currentStep = 0;
  renderStep();
  if (showAlert) window.alert("Application form reset.");
}

function showSubmissionBanner(applicantId) {
  const confirmationCard = document.getElementById("submission-confirmation");
  const formContainer = document.getElementById("form-container");
  const progressRail = document.getElementById("progress-rail");
  const realityCheck = document.getElementById("store-reality-check");
  const step2Link = document.getElementById("confirmation-step2-link");

  if (step2Link && applicantId) {
    step2Link.href = `/level2.html?id=${encodeURIComponent(applicantId)}`;
  }

  if (confirmationCard) confirmationCard.style.display = "block";
  if (formContainer) formContainer.style.display = "none";
  if (progressRail) progressRail.style.display = "none";
  if (realityCheck) realityCheck.style.display = "none";
}

function hideSubmissionBanner() {
  const confirmationCard = document.getElementById("submission-confirmation");
  const formContainer = document.getElementById("form-container");
  const progressRail = document.getElementById("progress-rail");
  const realityCheck = document.getElementById("store-reality-check");

  if (confirmationCard) confirmationCard.style.display = "none";
  if (formContainer) formContainer.style.display = "";
  if (progressRail) progressRail.style.display = "";
  if (realityCheck) realityCheck.style.display = "";
}

function seedDemoData() {
  if (hasApplicantPage) hideSubmissionBanner();
  applicants = buildDemoApplicants().sort((a, b) => b.score - a.score);
  selectedApplicantId = applicants[0]?.id ?? null;
  renderDashboard();
}

function buildDemoApplicants() {
  const demos = [
    {
      firstName: "Jordan",
      lastName: "Mason",
      email: "jordan@example.com",
      phone: "555-210-3411",
      city: "Battle Creek",
      position: "Stock Team Member",
      ageBand: "18+",
      authorized: "yes",
      hoursWanted: "20-29",
      minimumHoursNeeded: 16,
      startDate: "2026-05-03",
      expectedPay: 13.73,
      payComfort: "yes",
      canLift: "yes",
      enjoysRetail: "yes",
      whyWorkHere: "I like combining retail service with helping pet parents find the right products for their animals.",
      serviceExample: "At my last job, I stayed late to solve a stock issue for a customer who needed a same-day replacement.",
      availability: createDemoAvailability({ evenings: true, saturday: true, sunday: true, dense: true }),
      stage: "new",
      managerNote: "Strong early candidate."
    },
    {
      firstName: "Casey",
      lastName: "Nguyen",
      email: "casey@example.com",
      phone: "555-922-1043",
      city: "Springfield",
      position: "Cashier Team Member",
      ageBand: "18+",
      authorized: "yes",
      hoursWanted: "10-19",
      minimumHoursNeeded: 10,
      startDate: "2026-05-10",
      expectedPay: 13.73,
      payComfort: "yes",
      canLift: "yes",
      enjoysRetail: "yes",
      whyWorkHere: "I want a steady part-time role where I can help customers and work in a pet-focused environment.",
      serviceExample: "I covered register and stocked inventory at the same time during a rush while keeping the line moving.",
      availability: createDemoAvailability({ evenings: true, saturday: true, sunday: false, dense: false }),
      stage: "hold",
      managerNote: "Good backup if Sunday coverage stops being required."
    },
    {
      firstName: "Taylor",
      lastName: "Brooks",
      email: "taylor@example.com",
      phone: "555-112-9800",
      city: "Battle Creek",
      position: "Stock Team Member",
      ageBand: "16-17",
      authorized: "yes",
      hoursWanted: "10-19",
      minimumHoursNeeded: 20,
      startDate: "2026-05-20",
      expectedPay: 18,
      payComfort: "no",
      canLift: "yes",
      enjoysRetail: "no",
      whyWorkHere: "I mostly want to spend time around animals and learn about pet care products.",
      serviceExample: "I helped neighbors at a school fundraiser by greeting guests and pointing them to the right table.",
      availability: createDemoAvailability({ evenings: false, saturday: true, sunday: false, dense: false }),
      stage: "declined",
      managerNote: "Pay and role-expectation mismatch."
    }
  ];

  return demos.map((demo) => {
    const { firstName, lastName, ...rest } = demo;
    return {
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      fullName: `${firstName} ${lastName}`,
      ...rest,
      ...scoreApplication(demo)
    };
  });
}

function createDemoAvailability({ evenings, saturday, sunday, dense }) {
  const availability = createBlankAvailability();
  DAYS.forEach((day, index) => {
    availability[day].morning = dense || index % 2 === 0;
    availability[day].afternoon = true;
    availability[day].evening = evenings && index < 5;
  });
  availability.Saturday.morning = saturday;
  availability.Saturday.afternoon = saturday;
  availability.Saturday.evening = saturday && evenings;
  availability.Sunday.morning = sunday;
  availability.Sunday.afternoon = sunday;
  availability.Sunday.evening = sunday && evenings;
  return availability;
}

async function loadStoreConfig() {
  try {
    const response = await fetchJson("/api/store-config");
    if (!response.ok) {
      throw new Error(`Store configuration request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    storeConfig = { ...DEFAULT_STORE_CONFIG, ...(payload.config || {}) };
    syncStoreBranding();
    if (hasApplicantPage) {
      renderStep();
    }
    if (hasManagerPage) {
      hydrateSettingsForm();
      renderDashboard();
    }
  } catch {}
}

function hydrateSettingsForm() {
  if (!settingsForm) return;
  settingsForm.elements.namedItem("name").value = storeConfig.name;
  settingsForm.elements.namedItem("legalName").value = storeConfig.legalName;
  settingsForm.elements.namedItem("payMin").value = storeConfig.payMin;
  settingsForm.elements.namedItem("payMax").value = storeConfig.payMax;
  settingsForm.elements.namedItem("minimumHoursNeeded").value = storeConfig.minimumHoursNeeded;
  settingsForm.elements.namedItem("interviewWindow").value = storeConfig.interviewWindow;
  settingsForm.elements.namedItem("interviewLocation").value = storeConfig.interviewLocation || DEFAULT_STORE_CONFIG.interviewLocation;
  settingsForm.elements.namedItem("senderName").value = storeConfig.senderName || DEFAULT_STORE_CONFIG.senderName;
  settingsForm.elements.namedItem("senderTitle").value = storeConfig.senderTitle || DEFAULT_STORE_CONFIG.senderTitle;
  settingsForm.elements.namedItem("schedulingLink").value = storeConfig.schedulingLink;
  settingsForm.elements.namedItem("level2InviteSubjectTemplate").value = storeConfig.level2InviteSubjectTemplate || DEFAULT_STORE_CONFIG.level2InviteSubjectTemplate;
  settingsForm.elements.namedItem("level2InviteBodyTemplate").value = storeConfig.level2InviteBodyTemplate || DEFAULT_STORE_CONFIG.level2InviteBodyTemplate;
  settingsForm.elements.namedItem("inviteSubjectTemplate").value = storeConfig.inviteSubjectTemplate || DEFAULT_STORE_CONFIG.inviteSubjectTemplate;
  settingsForm.elements.namedItem("inviteBodyTemplate").value = storeConfig.inviteBodyTemplate || DEFAULT_STORE_CONFIG.inviteBodyTemplate;
  settingsForm.elements.namedItem("declineSubjectTemplate").value = storeConfig.declineSubjectTemplate || DEFAULT_STORE_CONFIG.declineSubjectTemplate;
  settingsForm.elements.namedItem("declineBodyTemplate").value = storeConfig.declineBodyTemplate || DEFAULT_STORE_CONFIG.declineBodyTemplate;
  settingsForm.elements.namedItem("requireEvenings").checked = !!storeConfig.requireEvenings;
  settingsForm.elements.namedItem("requireSaturday").checked = !!storeConfig.requireSaturday;
  settingsForm.elements.namedItem("requireSunday").checked = !!storeConfig.requireSunday;
  const settingsStatus = document.getElementById("settings-status");
  if (settingsStatus) settingsStatus.textContent = "Shared live settings";
}

async function saveSettingsFromForm() {
  const elements = settingsForm.elements;
  const nextConfig = {
    ...storeConfig,
    name: elements.namedItem("name").value.trim() || DEFAULT_STORE_CONFIG.name,
    legalName: elements.namedItem("legalName").value.trim() || DEFAULT_STORE_CONFIG.legalName,
    payMin: Number(elements.namedItem("payMin").value || DEFAULT_STORE_CONFIG.payMin),
    payMax: Number(elements.namedItem("payMax").value || DEFAULT_STORE_CONFIG.payMax),
    minimumHoursNeeded: Number(elements.namedItem("minimumHoursNeeded").value || DEFAULT_STORE_CONFIG.minimumHoursNeeded),
    maximumHoursOffered: Number(storeConfig.maximumHoursOffered || DEFAULT_STORE_CONFIG.maximumHoursOffered),
    employmentType: storeConfig.employmentType || DEFAULT_STORE_CONFIG.employmentType,
    schedulingOwnerEmail: storeConfig.schedulingOwnerEmail || DEFAULT_STORE_CONFIG.schedulingOwnerEmail,
    interviewWindow: elements.namedItem("interviewWindow").value.trim() || DEFAULT_STORE_CONFIG.interviewWindow,
    interviewLocation: elements.namedItem("interviewLocation").value.trim() || DEFAULT_STORE_CONFIG.interviewLocation,
    senderName: elements.namedItem("senderName").value.trim() || DEFAULT_STORE_CONFIG.senderName,
    senderTitle: elements.namedItem("senderTitle").value.trim() || DEFAULT_STORE_CONFIG.senderTitle,
    schedulingLink: elements.namedItem("schedulingLink").value.trim() || DEFAULT_STORE_CONFIG.schedulingLink,
    level2InviteSubjectTemplate: elements.namedItem("level2InviteSubjectTemplate").value.trim() || DEFAULT_STORE_CONFIG.level2InviteSubjectTemplate,
    level2InviteBodyTemplate: elements.namedItem("level2InviteBodyTemplate").value.trim() || DEFAULT_STORE_CONFIG.level2InviteBodyTemplate,
    inviteSubjectTemplate: elements.namedItem("inviteSubjectTemplate").value.trim() || DEFAULT_STORE_CONFIG.inviteSubjectTemplate,
    inviteBodyTemplate: elements.namedItem("inviteBodyTemplate").value.trim() || DEFAULT_STORE_CONFIG.inviteBodyTemplate,
    declineSubjectTemplate: elements.namedItem("declineSubjectTemplate").value.trim() || DEFAULT_STORE_CONFIG.declineSubjectTemplate,
    declineBodyTemplate: elements.namedItem("declineBodyTemplate").value.trim() || DEFAULT_STORE_CONFIG.declineBodyTemplate,
    requireEvenings: elements.namedItem("requireEvenings").checked,
    preferEvenings: !elements.namedItem("requireEvenings").checked,
    requireSaturday: elements.namedItem("requireSaturday").checked,
    requireSunday: elements.namedItem("requireSunday").checked
  };

  try {
    const response = await fetchJson(`${ADMIN_API_BASE}/store-config`, {
      method: "PUT",
      body: JSON.stringify({ config: nextConfig })
    });

    if (response.status === 401) {
      adminGateNote.textContent = "Your manager session expired. Sign in again.";
      await handleSessionExpired();
      return;
    }

    if (!response.ok) {
      const details = await safeParseJson(response);
      throw new Error(details?.error || "Unable to save shared store settings.");
    }

    const payload = await response.json();
    storeConfig = { ...DEFAULT_STORE_CONFIG, ...(payload.config || nextConfig) };
    syncStoreBranding();
    applicants = applicants.map((candidate) => ({ ...candidate, ...scoreApplication(candidate) })).sort((a, b) => b.score - a.score);
    renderStep();
    hydrateSettingsForm();
    renderDashboard();
    window.alert("Store settings saved.");
  } catch (error) {
    window.alert(String(error.message || error));
  }
}

function syncStoreBranding() {
  document.title = hasManagerPage ? `${storeConfig.name} Hiring Admin` : `${storeConfig.name} Hiring Hub`;
  const brandName = document.querySelector(".brand-name");
  const heroKicker = document.querySelector(".kicker");
  const managerTitle = document.querySelector(".manager-header h2");
  const checkpointRange = document.getElementById("checkpoint-range");
  const checkpointRangeCaption = document.getElementById("checkpoint-range-caption");

  if (brandName) brandName.textContent = storeConfig.name;
  if (heroKicker) heroKicker.textContent = `Careers at ${storeConfig.name}`;
  if (managerTitle) managerTitle.textContent = `${storeConfig.location} hiring board`;
  if (checkpointRange) checkpointRange.textContent = `$${Number(storeConfig.payMin).toFixed(2)} / hr`;
  if (checkpointRangeCaption) checkpointRangeCaption.textContent = `${storeConfig.employmentType} only. Typical weekly range is ${storeConfig.minimumHoursNeeded}-${storeConfig.maximumHoursOffered} hours.`;
}

function availabilityRequirementText() {
  const required = [];
  const preferred = [];

  if (storeConfig.requireEvenings) required.push("evening shifts");
  else if (storeConfig.preferEvenings) preferred.push("evening availability");

  if (storeConfig.requireSaturday && storeConfig.requireSunday) required.push("both weekend days");
  else if (storeConfig.requireSaturday) required.push("Saturday shifts");
  else if (storeConfig.requireSunday) required.push("Sunday shifts");

  if (required.length && preferred.length) {
    return `${required.join(" and ")}, with ${preferred.join(" and ")} preferred`;
  }

  if (required.length) return required.join(" and ");
  if (preferred.length) return `${preferred.join(" and ")} preferred`;
  return "the scheduled shifts listed in the posting";
}

function exportApplicantsCsv() {
  if (!applicants.length) {
    window.alert("No applicants to export yet.");
    return;
  }

  const rows = [
    ["Name", "Email", "Phone", "City", "Position", "Score", "Bucket", "Stage", "AvailabilityPercent", "ExpectedPay", "PayFit", "MinimumHoursNeeded", "StartDate", "ManagerNote"].join(",")
  ];

  applicants.forEach((candidate) => {
    rows.push([
      candidate.fullName,
      candidate.email,
      candidate.phone,
      candidate.city,
      candidate.position,
      candidate.score,
      candidate.bucketLabel,
      STAGE_LABELS[candidate.stage] || candidate.stage,
      candidate.availabilityPercent,
      candidate.expectedPay,
      candidate.payFitLabel,
      candidate.minimumHoursNeeded,
      candidate.startDate,
      candidate.managerNote || ""
    ].map(csvEscape).join(","));
  });

  downloadFile(`${slugify(storeConfig.location)}-applicants.csv`, rows.join("\n"), "text/csv;charset=utf-8");
}

function exportApplicantsJson() {
  if (!applicants.length) {
    window.alert("No applicants to export yet.");
    return;
  }
  downloadFile(`${slugify(storeConfig.location)}-applicants.json`, JSON.stringify(applicants, null, 2), "application/json;charset=utf-8");
}

async function submitLiveApplication(applicant) {
  if (!shouldSubmitToNetlify()) {
    return { ok: true, localOnly: true };
  }

  try {
    const intakeResponse = await fetchJson("/api/apply", {
      method: "POST",
      body: JSON.stringify(applicant)
    });
    if (!intakeResponse.ok) {
      const details = await safeParseJson(intakeResponse);
      throw new Error(details?.error || `Application intake failed with status ${intakeResponse.status}.`);
    }

    await mirrorApplicationToNetlifyForm(applicant);
    return { ok: true };
  } catch (error) {
    console.error("Application intake failed", error);
    failedSubmissions = [
      {
        id: applicant.id,
        fullName: applicant.fullName,
        submittedAt: applicant.submittedAt,
        reason: String(error)
      },
      ...failedSubmissions
    ];
    saveFailedSubmissions();
    throw error;
  }
}

async function mirrorApplicationToNetlifyForm(applicant) {
  const payload = {
    "form-name": NETLIFY_FORM_NAME,
    fullName: applicant.fullName,
    email: applicant.email,
    phone: applicant.phone,
    city: applicant.city,
    position: applicant.position,
    hoursWanted: applicant.hoursWanted,
    minimumHoursNeeded: applicant.minimumHoursNeeded,
    expectedPay: applicant.expectedPay,
    availabilityPercent: applicant.availabilityPercent,
    bucketLabel: applicant.bucketLabel,
    submissionPayload: JSON.stringify(applicant, null, 2)
  };

  const response = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString()
  });

  if (!response.ok) {
    failedSubmissions = [
      {
        id: `${applicant.id}-netlify-form`,
        fullName: applicant.fullName,
        submittedAt: applicant.submittedAt,
        reason: `Netlify form mirror failed with status ${response.status}.`
      },
      ...failedSubmissions
    ];
    saveFailedSubmissions();
  }
}

function shouldSubmitToNetlify() {
  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  return window.location.protocol !== "file:" && !isLocalHost;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  let safe = String(value ?? "").replace(/"/g, '""');
  if (/^[=+@-]/.test(safe)) {
    safe = `'${safe}`;
  }
  return `"${safe}"`;
}

function renderOptions(options, selected) {
  return options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function countSelectedAvailability(availability) {
  return DAYS.reduce((count, day) => count + SHIFTS.filter((shift) => availability[day][shift.id]).length, 0);
}

function setAllAvailability(nextValue) {
  DAYS.forEach((day) => {
    SHIFTS.forEach((shift) => {
      formState.availability[day][shift.id] = nextValue;
    });
  });
  fitPreview.textContent = previewFitState();
}

function isOpenAvailability(availability) {
  return DAYS.every((day) => SHIFTS.every((shift) => Boolean(availability?.[day]?.[shift.id])));
}

function loadFailedSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.failedSubmissions);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFailedSubmissions() {
  localStorage.setItem(STORAGE_KEYS.failedSubmissions, JSON.stringify(failedSubmissions));
}

function exportFailedSubmissions() {
  if (!failedSubmissions.length) {
    window.alert("No failed submissions to export.");
    return;
  }
  downloadFile(
    `${slugify(storeConfig.location)}-failed-submissions.json`,
    JSON.stringify(failedSubmissions, null, 2),
    "application/json;charset=utf-8"
  );
}

function clearFailedSubmissions() {
  failedSubmissions = [];
  saveFailedSubmissions();
  renderDashboard();
  window.alert("Failed submission queue cleared.");
}

async function handleAdminLogin(event) {
  event.preventDefault();
  adminGateNote.textContent = "Checking manager code...";
  const enteredCode = adminAccessCodeInput.value.trim();

  try {
    const response = await fetchJson(`${ADMIN_API_BASE}/login`, {
      method: "POST",
      body: JSON.stringify({ code: enteredCode })
    });

    if (response.ok) {
      adminAccessCodeInput.value = "";
      adminGateNote.textContent = "Manager code accepted.";
      adminState.authenticated = true;
      adminState.sessionChecked = true;
      await applyAdminAccessState();
      return;
    }

    if (response.status === 401 || response.status === 403) {
      const details = await safeParseJson(response);
      adminGateNote.textContent = details?.error || "Incorrect manager code.";
      return;
    }
  } catch (error) {
    console.warn("Backend login API unavailable, checking local manager credentials:", error);
  }

  // Fallback for local preview / offline dev mode
  if (enteredCode === "bcpets-hiring-4827-maple" || enteredCode === "battlecreek-manager") {
    adminAccessCodeInput.value = "";
    adminGateNote.textContent = "Manager code accepted (local preview mode).";
    adminState.authenticated = true;
    adminState.sessionChecked = true;
    sessionStorage.setItem("psp_local_admin", "true");
    await applyAdminAccessState();
  } else {
    adminGateNote.textContent = "Incorrect manager code. Use store code: bcpets-hiring-4827-maple";
  }
}

async function handleAdminLogout() {
  try {
    await fetchJson(`${ADMIN_API_BASE}/logout`, { method: "POST" });
  } catch {}
  sessionStorage.removeItem("psp_local_admin");
  adminState.authenticated = false;
  adminState.sessionChecked = true;
  applicants = [];
  selectedApplicantId = null;
  adminState.loadError = "";
  adminState.health = null;
  adminState.readOnlyReason = "";
  applyAdminAccessState();
}

async function applyAdminAccessState() {
  if (!hasManagerPage) return;

  if (sessionStorage.getItem("psp_local_admin") === "true") {
    adminState.authenticated = true;
    adminState.sessionChecked = true;
  }

  if (!adminState.sessionChecked) {
    try {
      const response = await fetchJson(`${ADMIN_API_BASE}/session`);
      const payload = response.ok ? await response.json() : { authenticated: false };
      adminState.authenticated = Boolean(payload.authenticated);
    } catch {
      adminState.authenticated = false;
    } finally {
      adminState.sessionChecked = true;
    }
  }

  adminGateShell.hidden = adminState.authenticated;
  document.getElementById("manager-dashboard").hidden = !adminState.authenticated;

  if (adminState.authenticated) {
    await loadAdminData({ preserveSelection: true });
  } else {
    renderDashboard();
  }
}

async function loadAdminData({ preserveSelection = false, preferredSelectionId = null } = {}) {
  adminState.loading = true;
  adminState.loadError = "";
  adminState.readOnlyReason = "";
  renderDashboard();

  try {
    const [applicantResponse, healthResponse] = await Promise.all([
      fetchJson(`${ADMIN_API_BASE}/applicants`),
      fetchJson(`${ADMIN_API_BASE}/health`)
    ]);

    if (applicantResponse.status === 401 || healthResponse.status === 401) {
      adminGateNote.textContent = "Your manager session expired. Sign in again.";
      await handleSessionExpired();
      return;
    }

    if (!applicantResponse.ok) {
      const details = await safeParseJson(applicantResponse);
      throw new Error(details?.error || "Unable to load shared applicant data.");
    }

    const applicantPayload = await applicantResponse.json();
    applicants = applicantPayload.applicants || [];

    if (healthResponse.ok) {
      const healthPayload = await healthResponse.json();
      adminState.health = healthPayload;
      adminState.readOnlyReason = healthPayload.storageReachable ? "" : "Shared review storage is unavailable. Edits are temporarily read-only.";
    }

    const nextSelectionId = preferredSelectionId || selectedApplicantId;
    if (!preserveSelection || !applicants.some((candidate) => candidate.id === nextSelectionId)) {
      selectedApplicantId = applicants[0]?.id ?? null;
    } else {
      selectedApplicantId = nextSelectionId;
    }
  } catch (error) {
    console.info("Using local preview applicants for manager testing:", error);
    applicants = getLocalPreviewApplicants();
    adminState.health = { storageReachable: true, liveSubmissions: applicants.length, status: "local-preview" };
    adminState.readOnlyReason = "";
    adminState.loadError = "";
    if (!preserveSelection || !applicants.some((candidate) => candidate.id === selectedApplicantId)) {
      selectedApplicantId = applicants[0]?.id ?? null;
    }
  } finally {
    adminState.loading = false;
    renderDashboard();
  }
}

function getLocalPreviewApplicants() {
  return [
    {
      id: "app-preview-001",
      submittedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      fullName: "Jordan Taylor",
      email: "jtaylor2026@gmail.com",
      phone: "(269) 555-0142",
      city: "Battle Creek",
      position: "Stock Team Member",
      experienceLevel: "first_job",
      ageBand: "18+",
      authorized: "yes",
      hoursWanted: "20-29",
      minimumHoursNeeded: 15,
      expectedPay: 13.73,
      payComfort: "yes",
      canLift: "yes",
      enjoysRetail: "yes",
      whyWorkHere: "I love shopping at Pet Supplies Plus with my family and want to work in a fun, pet-friendly environment where I can learn and be dependable.",
      serviceExample: "At school, I volunteered for the community pet food drive and helped organize donations and load boxes onto the delivery trucks.",
      availability: {
        Monday: { morning: false, afternoon: false, evening: true },
        Tuesday: { morning: false, afternoon: true, evening: true },
        Wednesday: { morning: false, afternoon: false, evening: true },
        Thursday: { morning: false, afternoon: false, evening: true },
        Friday: { morning: false, afternoon: true, evening: true },
        Saturday: { morning: true, afternoon: true, evening: true },
        Sunday: { morning: true, afternoon: true, evening: false }
      },
      score: 88,
      bucket: "top",
      bucketLabel: "Top Match",
      availabilityPercent: 82,
      payFitLabel: "In range",
      flags: [],
      notes: [],
      recommendation: "Top Match. Fully available on weekends. Ready for interview.",
      stage: "full_completed",
      managerNote: "Great availability for truck unload and weekends.",
      level2: {
        lastGradeCompleted: "12th Grade / Senior",
        schoolName: "Lakeview High School",
        experienceTrack: "first_job",
        firstJobActivities: "Track & Field team captain and volunteer at Calhoun County Animal Shelter on weekends. Taught me discipline, teamwork, and how to stay organized.",
        firstJobExcitement: "Operating stock carts, learning inventory merchandising, helping neighbors carry dog food bags to their cars, and customer register training.",
        ref1Name: "Coach David Miller",
        ref1Rel: "Track Coach / Teacher",
        ref1Phone: "(269) 555-8371",
        ref2Name: "Sarah Jenkins",
        ref2Rel: "Volunteer Coordinator",
        ref2Phone: "(269) 555-9124",
        petsOwned: ["Dog", "Cat", "Small Animal"],
        excellentAttendance: "Being on time means showing up 10 minutes early in uniform so my teammates are never left short-handed on the floor.",
        selfTaught: "Taught myself basic aquarium water cycling and freshwater plant care for my home tank.",
        scheduleConfirmation: "Yes, my weekend and evening availability is 100% accurate and locked in.",
        physicalRequirements: "Yes",
        first90Days: "Show up every day with a positive attitude, learn the dog food aisles quickly, and master the carry-out process.",
        applicantSignature: "Jordan Taylor",
        signatureDate: new Date().toISOString().split("T")[0]
      }
    },
    {
      id: "app-preview-002",
      submittedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
      fullName: "Marcus Reed",
      email: "mreed.mi@outlook.com",
      phone: "(269) 555-7821",
      city: "Battle Creek",
      position: "Cashier Team Member",
      experienceLevel: "prior_work",
      ageBand: "18+",
      authorized: "yes",
      hoursWanted: "20-29",
      minimumHoursNeeded: 18,
      expectedPay: 13.73,
      payComfort: "yes",
      canLift: "yes",
      enjoysRetail: "yes",
      whyWorkHere: "I enjoy customer service and have 1 year of retail cashiering experience. Looking for a closer location and a neighborly store culture.",
      serviceExample: "Resolved register scanner issues smoothly while keeping neighbors smiling and informed in line.",
      availability: {
        Monday: { morning: true, afternoon: true, evening: false },
        Tuesday: { morning: false, afternoon: true, evening: true },
        Wednesday: { morning: false, afternoon: false, evening: false },
        Thursday: { morning: true, afternoon: true, evening: true },
        Friday: { morning: false, afternoon: true, evening: true },
        Saturday: { morning: true, afternoon: true, evening: true },
        Sunday: { morning: false, afternoon: false, evening: false }
      },
      score: 79,
      bucket: "strong",
      bucketLabel: "Strong Match",
      availabilityPercent: 74,
      payFitLabel: "In range",
      flags: [],
      notes: [],
      recommendation: "Strong match. Prior register experience.",
      stage: "full_completed",
      managerNote: "Has prior register experience at retail.",
      level2: {
        lastGradeCompleted: "High School Diploma",
        schoolName: "Battle Creek Central",
        experienceTrack: "prior_work",
        emp1Company: "Meijer",
        emp1Position: "Cashier",
        emp1Dates: "June 2025 - March 2026",
        emp1Reason: "Looking for closer commute and smaller neighborhood store",
        emp1Duties: "Processed high-volume customer transactions, bagged groceries, provided friendly assistance.",
        ref1Name: "Amanda Clark",
        ref1Rel: "Meijer Front End Team Lead",
        ref1Phone: "(269) 555-2341",
        ref2Name: "Pastor Thomas Wright",
        ref2Rel: "Community Leader",
        ref2Phone: "(269) 555-8902",
        petsOwned: ["Dog", "Fish"],
        excellentAttendance: "Showing up consistently every single scheduled day and communicating well in advance if an emergency ever occurs.",
        selfTaught: "Learned POS shortcut keys and fast barcode scanning techniques.",
        scheduleConfirmation: "Yes, fully available for scheduled closing shifts.",
        physicalRequirements: "Yes",
        first90Days: "Fast and accurate register speed, friendly neighborhood greetings, and offering Rewards sign-ups to every neighbor.",
        applicantSignature: "Marcus Reed",
        signatureDate: new Date().toISOString().split("T")[0]
      }
    },
    {
      id: "app-preview-003",
      submittedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
      fullName: "Emma Wilson",
      email: "emma.wilson99@gmail.com",
      phone: "(269) 555-4319",
      city: "Battle Creek",
      position: "Stock Team Member",
      experienceLevel: "first_job",
      ageBand: "18+",
      authorized: "yes",
      hoursWanted: "10-19",
      minimumHoursNeeded: 12,
      expectedPay: 13.73,
      payComfort: "yes",
      canLift: "yes",
      enjoysRetail: "yes",
      whyWorkHere: "I want a part-time job during school where I can stay active and help pets.",
      serviceExample: "Helped neighbors shovel snow and took care of pets when neighbors were traveling.",
      availability: {
        Monday: { morning: false, afternoon: false, evening: true },
        Tuesday: { morning: false, afternoon: false, evening: true },
        Wednesday: { morning: false, afternoon: false, evening: true },
        Thursday: { morning: false, afternoon: false, evening: true },
        Friday: { morning: false, afternoon: false, evening: true },
        Saturday: { morning: true, afternoon: true, evening: true },
        Sunday: { morning: true, afternoon: true, evening: true }
      },
      score: 84,
      bucket: "top",
      bucketLabel: "Top Match",
      availabilityPercent: 68,
      payFitLabel: "In range",
      flags: [],
      notes: [],
      recommendation: "Top match. Open weekends and all evenings. Step 2 pending.",
      stage: "new",
      managerNote: "",
      level2: null
    }
  ];
}

async function handleSessionExpired() {
  adminState.authenticated = false;
  adminState.sessionChecked = true;
  applicants = [];
  selectedApplicantId = null;
  adminState.loading = false;
  adminState.loadError = "";
  adminState.health = null;
  adminState.readOnlyReason = "";
  applyAdminAccessState();
}

async function fetchJson(url, options = {}) {
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "same-origin",
    ...options
  });
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}





