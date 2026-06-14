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
  interviewWindow: "Tuesdays and Fridays from 3:00 PM to 4:00 PM, 20-minute interviews with a 10-minute buffer",
  interviewLocation: "1791 W. Columbia Ave, Battle Creek, MI",
  senderName: "Chris Brennan",
  senderTitle: "Store Team Leader",
  level2Url: "https://psp.battlecreekjobs.app/level2.html",
  level2InviteSubjectTemplate: "{{storeName}} application next steps",
  level2InviteBodyTemplate: `Hi {{firstName}},

Thank you for applying to {{storeName}}. You've passed our initial screening!

Before we set up an interview, we would like to gather a little more information regarding your work and education history. 

Please take a few minutes to complete the follow-up application here:
{{level2Url}}

If you have any questions, please let us know.

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

const STAGES = ["new", "interview", "hold", "declined", "hired"];
const STAGE_LABELS = {
  new: "New",
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
let level2Applicants = [];
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
      <div class="field">
        <label for="city">City</label>
        <input id="city" name="city" value="${escapeHtml(formState.city)}" required>
      </div>
      <div class="field">
        <label for="position">Position of interest</label>
        <select id="position" name="position">
          ${renderOptions(["Stock Team Member", "Cashier Team Member"], formState.position)}
        </select>
        <div class="helper-banner role-helper">${renderRoleSummary(formState.position)}</div>
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
            <p>Preferred for open availability and standard scheduling.</p>
          </label>
        </div>
        <div class="choice-card">
          <input id="ageBand-under18" type="radio" name="ageBand" value="16-17" ${formState.ageBand === "16-17" ? "checked" : ""}>
          <label for="ageBand-under18">
            <h4>I am 16-17 years old</h4>
            <p>Still eligible to apply, but schedule options may be limited.</p>
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
            <p>This is required before an offer can be made.</p>
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
    <div class="helper-banner">We ask about schedule early so you can see whether this opening matches the hours you want. Evening availability is helpful, but not required, for the current Battle Creek setup.</div>
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
      <p class="grid-label">Weekly availability</p>
      <div class="availability-tools">
        <label class="availability-quick-toggle" for="open-availability">
          <input id="open-availability" type="checkbox" ${isOpenAvailability(formState.availability) ? "checked" : ""}>
          <span>Open availability</span>
        </label>
        <button class="button button-secondary button-inline" type="button" id="select-all-availability">Check all shifts</button>
        <button class="button button-secondary button-inline" type="button" id="clear-all-availability">Clear all</button>
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
              ${DAYS.map((day) => `
                <td>
                  <input
                    type="checkbox"
                    data-day="${day}"
                    data-shift="${shift.id}"
                    ${formState.availability[day][shift.id] ? "checked" : ""}
                  >
                </td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="availability-note">For this opening, we currently need ${availabilityRequirementText()}. Weekday shifts are usually 9-5, 11-7, or 5-9. Sunday hours are 10-6.</p>
    </div>
  `;
}

function renderPayStep() {
  return `
    <div class="range-box">
      <p class="range-label">Starting pay for this role</p>
      <strong>$${Number(storeConfig.payMin).toFixed(2)} - $${Number(storeConfig.payMax).toFixed(2)} / hr</strong>
      <p class="range-caption">${storeConfig.employmentType} only. Typical weekly range is ${storeConfig.minimumHoursNeeded}-${storeConfig.maximumHoursOffered} hours.</p>
      <p class="range-caption range-highlight">Team members are eligible for biannual reviews and raises up to 5% based on performance and business needs.</p>
    </div>
    <div class="field">
      <label>Does this starting pay work for you?</label>
      <div class="choice-grid">
        <label class="choice-card" for="payComfort-yes">
          <input id="payComfort-yes" type="radio" name="payComfort" value="yes" ${formState.payComfort === "yes" ? "checked" : ""}>
          <span>
            <h4>Yes, this starting pay works for me</h4>
            <p>That tells us the opportunity is aligned with what you are looking for right now.</p>
          </span>
        </label>
        <label class="choice-card" for="payComfort-no">
          <input id="payComfort-no" type="radio" name="payComfort" value="no" ${formState.payComfort === "no" ? "checked" : ""}>
          <span>
            <h4>No, I would need a higher starting rate</h4>
            <p>That is completely okay. We would rather be clear up front and respectful of your time.</p>
          </span>
        </label>
      </div>
    </div>
  `;
}

function renderFitStep() {
  const roleLead = {
    "Stock Team Member": "Passion for pets. Plus the roll-up-your-sleeves work. Stock Team Members help keep the store full, clean, and easy to shop through stocking, organizing product, customer carry-outs, 50 lb. pet food bags, cleaning, ladders, and general retail support.",
    "Cashier Team Member": "Passion for pets. Plus the roll-up-your-sleeves work. Cashier Team Members run the front register, help neighbors, support store cleanliness, and help care for our small animals, reptiles, amphibians, and arachnids."
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
            <h4>I am comfortable with lifting, stocking, cleaning, being on my feet, handling heavy pet food bags, and climbing ladders.</h4>
            <p>This includes handling pet food, helping neighbors, and supporting the day-to-day work of the store.</p>
          </span>
        </label>
        <label class="choice-card" for="canLift-no">
          <input id="canLift-no" type="radio" name="canLift" value="no" ${formState.canLift === "no" ? "checked" : ""}>
          <span>
            <h4>Those duties would be difficult for me.</h4>
            <p>We ask this up front so both sides can be clear about whether the role is a good fit.</p>
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
            <h4>I understand this is a retail role, not only a pet care role.</h4>
            <p>The job includes customer service, register work, and completing store tasks throughout the shift.</p>
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
      <label for="whyWorkHere">Why do you want to work at ${escapeHtml(storeConfig.name)}?</label>
      <textarea id="whyWorkHere" name="whyWorkHere" placeholder="Tell us what draws you to this store and this specific role.">${escapeHtml(formState.whyWorkHere)}</textarea>
    </div>
    <div class="field">
      <label for="serviceExample">Describe a time you helped a customer, stayed productive during a rush, or solved a problem.</label>
      <textarea id="serviceExample" name="serviceExample" placeholder="A short real example is enough.">${escapeHtml(formState.serviceExample)}</textarea>
    </div>
  `;
}

function renderReviewStep() {
  return `
    <div class="review-box">
      <strong>Final application review</strong>
      <ul>
        <li>Role selected: ${escapeHtml(formState.position || "Not selected")}</li>
        <li>Hours wanted: ${escapeHtml(formState.hoursWanted || "Not set")}</li>
        <li>Minimum weekly hours needed: ${escapeHtml(formState.minimumHoursNeeded || "Not set")}</li>
        <li>Starting pay acknowledged: ${formState.payComfort === "yes" ? "Yes" : formState.payComfort === "no" ? "Needs a higher starting rate" : "Not confirmed"}</li>
      </ul>
    </div>
    <div class="field-grid">
      <div class="field">
        <label>Applicant</label>
        <div class="helper-banner">${escapeHtml(`${formState.firstName} ${formState.lastName}`.trim() || "Name not entered yet")}</div>
      </div>
      <div class="field">
        <label>Position</label>
        <div class="helper-banner">${escapeHtml(formState.position || "Not selected")}</div>
      </div>
    </div>
    <div class="field">
      <label>Summary</label>
      <div class="helper-banner">
        ${escapeHtml(`${formState.hoursWanted || "Hours not set"} desired, minimum ${formState.minimumHoursNeeded || "?"} hrs, starting pay ${formState.payComfort === "yes" ? "confirmed" : formState.payComfort === "no" ? "not accepted" : "not confirmed"}`)}
      </div>
    </div>
    <div class="field checkbox-row checkbox-row-emphasis">
      <input id="confirm-submit" type="checkbox">
      <label for="confirm-submit">I confirm the information above is accurate and ready to submit.</label>
    </div>
  `;
}

function bindStepInputs() {
  document.getElementById("open-availability")?.addEventListener("change", (event) => {
    setAllAvailability(event.target.checked);
    renderStep();
  });

  document.getElementById("select-all-availability")?.addEventListener("click", () => {
    setAllAvailability(true);
    renderStep();
  });

  document.getElementById("clear-all-availability")?.addEventListener("click", () => {
    setAllAvailability(false);
    renderStep();
  });

  stepContent.querySelectorAll("input, select, textarea").forEach((element) => {
    if (element.id === "open-availability") {
      return;
    }
    if (element.type === "checkbox" && element.dataset.day && element.dataset.shift) {
      element.addEventListener("change", () => {
        formState.availability[element.dataset.day][element.dataset.shift] = element.checked;
        fitPreview.textContent = previewFitState();
      });
      return;
    }

    const syncValue = () => {
      if (element.type === "radio") {
        formState[element.name] = element.value;
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
  resetForm(false);
  showSubmissionBanner();
  document.getElementById("application")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const level2List = document.getElementById("level2-list");
  const level2Count = document.getElementById("level2-count");
  if (level2List && level2Count) {
    level2Count.textContent = `${level2Applicants.length} submitted`;
    if (adminState.loading) {
      level2List.innerHTML = `<div class="empty-state"><div><h3>Loading...</h3></div></div>`;
    } else if (level2Applicants.length) {
      level2List.innerHTML = level2Applicants.map(app => `
        <article class="candidate-item" style="cursor: default; align-items: center;">
          <div style="flex-grow: 1;">
            <strong>${escapeHtml(app.fullName || app.data?.fullName || "Unknown Applicant")}</strong>
            <p>${escapeHtml(app.phone || app.data?.phone || "")} • ${escapeHtml(app.email || app.data?.email || "")}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <p style="margin: 0;">${new Date(app.created_at || app.submittedAt).toLocaleDateString()}</p>
            <button class="button button-danger" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;" type="button" onclick="deleteLevel2Applicant('${app.id}')">Delete</button>
            <button class="button button-primary" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;" type="button" onclick="printLevel2Applicant('${app.id}')">View / Print</button>
          </div>
        </article>
      `).join("");
    } else {
      level2List.innerHTML = `<div class="empty-state"><div><h3>No Level 2 submissions yet</h3></div></div>`;
    }
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
  return `
    <button type="button" class="candidate-item ${activeClass}" data-id="${candidate.id}">
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
        <span class="tag ${candidate.payFitLabel === "Out of range" ? "alert" : ""}">${candidate.payFitLabel}</span>
        <span class="tag ${candidate.flags.includes("weekend-missing") ? "warn" : ""}">${candidate.flags.includes("weekend-missing") ? "Weekend gap" : "Weekend ready"}</span>
        <span class="tag neutral-stage">${STAGE_LABELS[candidate.stage] || "New"}</span>
      </div>
    </button>
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
          <p>Expected $${candidate.expectedPay.toFixed(2)} / hr</p>
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
        <div class="form-actions">
          <button class="button button-secondary" type="button" id="print-candidate">Print Application</button>
          <button class="button button-danger" type="button" id="delete-candidate">Delete Candidate</button>
        </div>
      </div>

      <section class="detail-section">
        <h4>Key details</h4>
        <ul class="detail-list">
          <li>Email: ${escapeHtml(candidate.email)}</li>
          <li>Phone: ${escapeHtml(candidate.phone)}</li>
          <li>Hours wanted: ${escapeHtml(candidate.hoursWanted)}</li>
          <li>Minimum weekly hours needed: ${candidate.minimumHoursNeeded}</li>
          <li>Employment type: ${escapeHtml(storeConfig.employmentType)}</li>
          <li>Start date: ${escapeHtml(candidate.startDate || "Not provided")}</li>
          <li>Authorized to work: ${candidate.authorized === "yes" ? "Yes" : "Needs review"}</li>
          <li>Interview location: ${escapeHtml(storeConfig.interviewLocation || DEFAULT_STORE_CONFIG.interviewLocation)}</li>
          <li>Hiring entity: ${escapeHtml(storeConfig.legalName)}</li>
        </ul>
      </section>

      <section class="detail-section">
        <h4>Submitted availability</h4>
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
        <h4>Manager notes from screening</h4>
        <div class="detail-notes">
          ${candidate.notes.length ? candidate.notes.map((note) => `<p>| ${escapeHtml(note)}</p>`).join("") : "<p>No risk flags triggered. Candidate is aligned with the current screen.</p>"}
        </div>
      </section>

      <section class="detail-section">
        <h4>Application responses</h4>
        <ul class="detail-list">
          <li>Why this job: ${escapeHtml(candidate.whyWorkHere)}</li>
          <li>Service example: ${escapeHtml(candidate.serviceExample)}</li>
        </ul>
      </section>

      <section class="detail-section">
        <h4>Email actions</h4>
        <div class="template-box compact-template-actions">
          <p>These buttons use the saved templates from Store Settings.</p>
          <div class="form-actions">
            <button class="button button-primary" type="button" id="open-invite-email">Open Interview Email</button>
            <button class="button button-secondary" type="button" id="copy-invite-message">Copy Interview Message</button>
            <button class="button button-primary" type="button" id="open-level2-email">Send Level 2 Application E-mail</button>
            <button class="button button-secondary" type="button" id="copy-level2-message">Copy Application Message</button>
            <button class="button button-secondary" type="button" id="open-decline-email">Open Decline Email</button>
            <button class="button button-secondary" type="button" id="copy-decline-message">Copy Decline Message</button>
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById("candidate-stage")?.addEventListener("change", async (event) => updateCandidate(selectedApplicantId, { stage: event.target.value, lastAction: "stage-change" }));
  document.getElementById("mark-interviewing")?.addEventListener("click", async () => updateCandidate(selectedApplicantId, { stage: "interview", lastAction: "mark-interviewing" }));
  document.getElementById("mark-declined")?.addEventListener("click", async () => updateCandidate(selectedApplicantId, { stage: "declined", lastAction: "mark-declined" }));
  document.getElementById("delete-candidate")?.addEventListener("click", async () => deleteCandidate(selectedApplicantId, candidate.fullName));
  document.getElementById("print-candidate")?.addEventListener("click", () => window.print());
  document.getElementById("open-invite-email")?.addEventListener("click", () => openMailto(buildMailtoLink(candidate.email, buildInviteSubject(candidate), buildInviteMessage(candidate))));
  document.getElementById("copy-invite-message")?.addEventListener("click", () => copyTextToClipboard(buildInviteMessage(candidate)));
  document.getElementById("open-level2-email")?.addEventListener("click", () => openMailto(buildMailtoLink(candidate.email, buildLevel2InviteSubject(candidate), buildLevel2InviteMessage(candidate))));
  document.getElementById("copy-level2-message")?.addEventListener("click", () => copyTextToClipboard(buildLevel2InviteMessage(candidate)));
  document.getElementById("open-decline-email")?.addEventListener("click", () => openMailto(buildMailtoLink(candidate.email, buildDeclineSubject(candidate), buildDeclineMessage(candidate))));
  document.getElementById("copy-decline-message")?.addEventListener("click", () => copyTextToClipboard(buildDeclineMessage(candidate)));
  document.getElementById("save-note")?.addEventListener("click", async () => {
    const managerNote = document.getElementById("manager-note")?.value ?? "";
    await updateCandidate(selectedApplicantId, { managerNote, lastAction: "save-note" });
    window.alert("Manager note saved.");
  });
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
    console.error("Failed to update candidate state:", error);
    alert(error.message || "An error occurred while updating the candidate.");
  } finally {
    adminState.loading = false;
    renderDashboard();
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

async function deleteLevel2Applicant(submissionId) {
  if (!confirm("Are you sure you want to completely delete this Level 2 application? This cannot be undone.")) {
    return;
  }

  adminState.loading = true;
  renderDashboard();

  try {
    const response = await fetchJson(`${ADMIN_API_BASE}/level2-applicants/${submissionId}`, { method: "DELETE" });
    if (!response.ok) {
      const details = await safeParseJson(response);
      throw new Error(details?.error || "Failed to delete Level 2 applicant.");
    }
    await loadManagerDashboard(true);
  } catch (error) {
    console.error("Failed to delete Level 2 applicant:", error);
    alert(error.message || "An error occurred while deleting.");
    adminState.loading = false;
    renderDashboard();
  }
}

function formatLevel2Data(app) {
  const qMap = {
    zipCode: "Zip Code",
    lastGradeCompleted: "Last grade completed",
    hoursPerWeek: "How many hours per week are you hoping to work?",
    schedulingRestrictions: "Are there any scheduling restrictions we should know about?",
    excellentAttendance: "What does excellent attendance mean to you?",
    absences: "In the last 12 months, how many times were you absent from a scheduled shift (or missed school if no experience)?",
    unexpectedLate: "Tell us about a time something unexpected happened that could have made you late or miss work. What did you do?",
    greatCustomerService: "Tell us about a time you provided great customer service.",
    whyPsp: "Why do you want to work at Pet Supplies Plus?",
    ownPets: "Do you currently own pets?",
    knowledgeablePets: "Which types of pets are you most knowledgeable about?",
    selfTaught: "What is something you have taught yourself or learned outside of school or work in the last year?",
    greatestStrengths: "What would your previous manager or teacher say are your greatest strengths?",
    areaToImprove: "What is one area they would suggest you improve?",
    physicalRequirements: "Can you perform these essential job functions with or without reasonable accommodation?",
    first90Days: "If we hired you tomorrow, what would make you successful during your first 90 days?",
    applicantSignature: "Applicant Signature",
    signatureDate: "Date Signed"
  };

  let html = "";
  
  // 1. Availability Map
  const availMap = {
    Morning: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].filter(d => app[`avail-${d}-morning`] === "yes"),
    Afternoon: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].filter(d => app[`avail-${d}-afternoon`] === "yes"),
    Evening: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].filter(d => app[`avail-${d}-evening`] === "yes")
  };
  let hasAvail = false;
  let availHtml = `<div style="margin-bottom: 1.5rem; page-break-inside: avoid;"><strong style="font-size: 1.1rem; border-bottom: 1px solid #ccc; display: block; margin-bottom: 0.5rem; padding-bottom: 0.25rem;">Availability</strong>`;
  for (const [shift, days] of Object.entries(availMap)) {
    if (days.length > 0) {
      hasAvail = true;
      availHtml += `<div style="margin-bottom: 0.25rem;"><strong>${shift}:</strong> ${days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}</div>`;
    }
  }
  availHtml += `</div>`;
  if (hasAvail) html += availHtml;

  // 2. Base Questions
  html += `<div style="margin-bottom: 1.5rem;"><strong style="font-size: 1.1rem; border-bottom: 1px solid #ccc; display: block; margin-bottom: 0.5rem; padding-bottom: 0.25rem;">General Questions</strong>`;
  for (const [key, q] of Object.entries(qMap)) {
    let val = app[key];
    if (val) {
      if (Array.isArray(val)) val = val.join(", ");
      html += `<div style="margin-bottom: 1rem; page-break-inside: avoid;"><strong style="color: #0f6f32;">${q}</strong><br>${escapeHtml(String(val))}</div>`;
    }
  }
  html += `</div>`;

  // 3. Employment
  if (app.emp1Company || app.emp2Company) {
    html += `<div style="margin-bottom: 1.5rem;"><strong style="font-size: 1.1rem; border-bottom: 1px solid #ccc; display: block; margin-bottom: 0.5rem; padding-bottom: 0.25rem;">Employment History</strong>`;
    [1, 2].forEach(i => {
      if (app[`emp${i}Company`]) {
        html += `<div style="margin-bottom: 1rem; padding-left: 1rem; border-left: 3px solid #0f6f32; page-break-inside: avoid;">
          <strong>${escapeHtml(app[`emp${i}Company`])}</strong> - ${escapeHtml(app[`emp${i}Position`] || "")} 
          <br><span style="color: #666; font-size: 0.9em;">Dates: ${escapeHtml(app[`emp${i}Dates`] || "")} | Reason for Leaving: ${escapeHtml(app[`emp${i}Reason`] || "")}</span>
          <br><strong style="font-size: 0.9em;">Duties:</strong> <span style="font-size: 0.9em;">${escapeHtml(app[`emp${i}Duties`] || "")}</span>
        </div>`;
      }
    });
    html += `</div>`;
  }

  // 4. References
  if (app.ref1Name || app.ref2Name) {
    html += `<div style="margin-bottom: 1.5rem;"><strong style="font-size: 1.1rem; border-bottom: 1px solid #ccc; display: block; margin-bottom: 0.5rem; padding-bottom: 0.25rem;">References</strong>`;
    [1, 2].forEach(i => {
      if (app[`ref${i}Name`]) {
        html += `<div style="margin-bottom: 0.5rem; padding-left: 1rem; border-left: 3px solid #0f6f32; page-break-inside: avoid;">
          <strong>${escapeHtml(app[`ref${i}Name`])}</strong> (${escapeHtml(app[`ref${i}Rel`] || "")}) - ${escapeHtml(app[`ref${i}Phone`] || "")}
        </div>`;
      }
    });
    html += `</div>`;
  }

  return html;
}

window.printLevel2Applicant = function(appId) {
  const app = level2Applicants.find(a => a.id === appId);
  if (!app) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Application - ${escapeHtml(app.fullName || app.data?.fullName || "Unknown Applicant")}</title>
      <style>
        body { font-family: "Segoe UI", sans-serif; line-height: 1.6; color: #333; padding: 2rem; max-width: 800px; margin: 0 auto; }
        h1 { margin-top: 0; font-size: 1.75rem; border-bottom: 2px solid #00af41; padding-bottom: 0.5rem; }
        .section { margin-bottom: 1.5rem; }
        .key { font-weight: bold; color: #555; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body onload="window.print()">
      <h1>${escapeHtml(app.fullName || app.data?.fullName || "Unknown Applicant")} - Level 2 Application</h1>
      <div class="section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #fcf8f0; padding: 1rem; border-radius: 8px;">
        <div><span class="key">Email:</span> ${escapeHtml(app.email || app.data?.email || "")}</div>
        <div><span class="key">Phone:</span> ${escapeHtml(app.phone || app.data?.phone || "")}</div>
        <div><span class="key">Date Submitted:</span> ${new Date(app.created_at || app.submittedAt).toLocaleDateString()}</div>
      </div>
      <div style="font-size: 1.05rem;">
        ${formatLevel2Data(app)}
      </div>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
};

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
  return {
    firstName: getCandidateFirstName(candidate),
    fullName: candidate?.fullName || "",
    storeName: storeConfig.name || DEFAULT_STORE_CONFIG.name,
    payRate: `$${Number(storeConfig.payMin || DEFAULT_STORE_CONFIG.payMin).toFixed(2)}`,
    availabilityRequirement: Object.entries(candidate.availability || {})
      .flatMap(([day, shifts]) => Object.entries(shifts).filter(([, selected]) => selected).map(([shift]) => `${day} ${shift}`))
      .join(", ") || "the hours you requested",
    schedulingLink: storeConfig.schedulingLink || DEFAULT_STORE_CONFIG.schedulingLink,
    level2Url: storeConfig.level2Url || DEFAULT_STORE_CONFIG.level2Url,
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

function showSubmissionBanner() {
  if (!submissionBanner) return;
  submissionBanner.hidden = false;
}

function hideSubmissionBanner() {
  if (!submissionBanner) return;
  submissionBanner.hidden = true;
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
  settingsForm.elements.namedItem("level2Url").value = storeConfig.level2Url || DEFAULT_STORE_CONFIG.level2Url;
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
    level2Url: elements.namedItem("level2Url").value.trim() || DEFAULT_STORE_CONFIG.level2Url,
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
  const safe = String(value ?? "").replace(/"/g, '""');
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

  try {
    const response = await fetchJson(`${ADMIN_API_BASE}/login`, {
      method: "POST",
      body: JSON.stringify({ code: adminAccessCodeInput.value.trim() })
    });

    if (!response.ok) {
      const details = await safeParseJson(response);
      adminGateNote.textContent = details?.error || "Incorrect manager code.";
      return;
    }

    adminAccessCodeInput.value = "";
    adminGateNote.textContent = "Manager code accepted.";
    adminState.sessionChecked = false;
    await applyAdminAccessState();
  } catch (error) {
    adminGateNote.textContent = "Manager sign-in is unavailable right now.";
  }
}

async function handleAdminLogout() {
  try {
    await fetchJson(`${ADMIN_API_BASE}/logout`, { method: "POST" });
  } catch {}
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
    const [applicantResponse, healthResponse, level2Response] = await Promise.all([
      fetchJson(`${ADMIN_API_BASE}/applicants`),
      fetchJson(`${ADMIN_API_BASE}/health`),
      fetchJson(`${ADMIN_API_BASE}/level2-applicants`).catch(() => ({ ok: true, json: async () => ({ applicants: [] }) }))
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

    if (!healthResponse.ok) {
      const details = await safeParseJson(healthResponse);
      throw new Error(details?.error || "Unable to load admin health data.");
    }

    const applicantPayload = await applicantResponse.json();
    const healthPayload = await healthResponse.json();
    let l2Payload = { applicants: [] };
    if (level2Response && level2Response.ok) {
      l2Payload = await level2Response.json();
    }

    applicants = applicantPayload.applicants || [];
    level2Applicants = l2Payload.applicants || [];
    adminState.health = healthPayload;
    adminState.readOnlyReason = healthPayload.storageReachable ? "" : "Shared review storage is unavailable. Manager edits are temporarily read-only.";

    const nextSelectionId = preferredSelectionId || selectedApplicantId;
    if (!preserveSelection || !applicants.some((candidate) => candidate.id === nextSelectionId)) {
      selectedApplicantId = applicants[0]?.id ?? null;
    } else {
      selectedApplicantId = nextSelectionId;
    }
  } catch (error) {
    applicants = [];
    selectedApplicantId = null;
    adminState.health = null;
    adminState.loadError = String(error.message || error);
  } finally {
    adminState.loading = false;
    renderDashboard();
  }
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





