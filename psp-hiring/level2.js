document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("level2-form");
  const submissionBanner = document.getElementById("submission-banner");
  const formContainer = document.getElementById("form-container");
  const candidateGreeting = document.getElementById("candidate-greeting");
  const candidateGreetingCard = document.getElementById("candidate-greeting-card");
  const applicantIdInput = document.getElementById("applicantId");
  const prefillNameInput = document.getElementById("prefillName");
  const prefillEmailInput = document.getElementById("prefillEmail");
  const prefillPhoneInput = document.getElementById("prefillPhone");
  const signatureInput = document.getElementById("applicantSignature");
  const signatureDateInput = document.getElementById("signatureDate");
  const submitButton = document.getElementById("submit-level2");

  // Track toggles
  const trackPrior = document.getElementById("track-prior");
  const trackFirst = document.getElementById("track-first");
  const employerTrack = document.getElementById("employer-track");
  const firstJobTrack = document.getElementById("first-job-track");
  const firstJobActivities = document.getElementById("firstJobActivities");
  const firstJobExcitement = document.getElementById("firstJobExcitement");

  // Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  const applicantId = params.get("id") || "";
  const applicantName = params.get("name") || "";
  const applicantEmail = params.get("email") || "";
  const applicantPhone = params.get("phone") || "";

  if (applicantId) applicantIdInput.value = applicantId;
  if (applicantName) {
    prefillNameInput.value = applicantName;
    if (signatureInput && !signatureInput.value) {
      signatureInput.value = applicantName;
    }
    if (candidateGreeting) {
      candidateGreeting.textContent = `Welcome back, ${applicantName}!`;
    }
  }
  if (applicantEmail) prefillEmailInput.value = applicantEmail;
  if (applicantPhone) prefillPhoneInput.value = applicantPhone;

  // Set default date to today
  if (signatureDateInput && !signatureDateInput.value) {
    signatureDateInput.value = new Date().toISOString().split("T")[0];
  }

  // Handle Experience Track Switching
  function updateTrack() {
    const isFirstJob = trackFirst && trackFirst.checked;
    const cards = document.querySelectorAll(".experience-card");
    cards.forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.classList.add("is-active");
      } else {
        card.classList.remove("is-active");
      }
    });

    if (isFirstJob) {
      if (employerTrack) employerTrack.style.display = "none";
      if (firstJobTrack) firstJobTrack.style.display = "block";
      if (firstJobActivities) firstJobActivities.required = true;
      if (firstJobExcitement) firstJobExcitement.required = true;
    } else {
      if (employerTrack) employerTrack.style.display = "block";
      if (firstJobTrack) firstJobTrack.style.display = "none";
      if (firstJobActivities) firstJobActivities.required = false;
      if (firstJobExcitement) firstJobExcitement.required = false;
    }
  }

  if (trackPrior) trackPrior.addEventListener("change", updateTrack);
  if (trackFirst) trackFirst.addEventListener("change", updateTrack);
  updateTrack();

  // Form Submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting Step 2...";
    }

    const formData = new FormData(form);
    const selectedPets = formData.getAll("ownPets");

    const level2Payload = {
      lastGradeCompleted: formData.get("lastGradeCompleted") || "",
      schoolName: formData.get("schoolName") || "",
      experienceTrack: formData.get("experienceTrack") || "prior_work",
      // Employer 1
      emp1Company: formData.get("emp1Company") || "",
      emp1Position: formData.get("emp1Position") || "",
      emp1Dates: formData.get("emp1Dates") || "",
      emp1Reason: formData.get("emp1Reason") || "",
      emp1Duties: formData.get("emp1Duties") || "",
      // Employer 2
      emp2Company: formData.get("emp2Company") || "",
      emp2Position: formData.get("emp2Position") || "",
      emp2Dates: formData.get("emp2Dates") || "",
      emp2Reason: formData.get("emp2Reason") || "",
      // First Job
      firstJobActivities: formData.get("firstJobActivities") || "",
      firstJobExcitement: formData.get("firstJobExcitement") || "",
      // References
      ref1Name: formData.get("ref1Name") || "",
      ref1Rel: formData.get("ref1Rel") || "",
      ref1Phone: formData.get("ref1Phone") || "",
      ref2Name: formData.get("ref2Name") || "",
      ref2Rel: formData.get("ref2Rel") || "",
      ref2Phone: formData.get("ref2Phone") || "",
      // Pet familiarity & attendance
      petsOwned: selectedPets,
      excellentAttendance: formData.get("excellentAttendance") || "",
      selfTaught: formData.get("selfTaught") || "",
      scheduleConfirmation: formData.get("scheduleConfirmation") || "",
      // Physical & success
      physicalRequirements: formData.get("physicalRequirements") || "Yes",
      first90Days: formData.get("first90Days") || "",
      // Signature
      applicantSignature: formData.get("applicantSignature") || "",
      signatureDate: formData.get("signatureDate") || "",
      submittedAt: new Date().toISOString()
    };

    const requestBody = {
      applicantId: formData.get("applicantId") || applicantId,
      fullName: formData.get("fullName") || applicantName,
      email: formData.get("email") || applicantEmail,
      phone: formData.get("phone") || applicantPhone,
      level2: level2Payload
    };

    try {
      const response = await fetch("/api/level2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      // Success
      if (candidateGreetingCard) candidateGreetingCard.style.display = "none";
      if (formContainer) formContainer.style.display = "none";
      if (submissionBanner) {
        submissionBanner.hidden = false;
        submissionBanner.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      console.warn("Primary API submission encountered an error, falling back to static Netlify form:", err);

      // Fallback submit via hidden static netlify form
      const fallbackForm = document.querySelector('form[name="level2-application"]');
      if (fallbackForm) {
        fallbackForm.querySelector('input[name="applicantId"]').value = requestBody.applicantId;
        fallbackForm.querySelector('input[name="fullName"]').value = requestBody.fullName;
        fallbackForm.querySelector('input[name="email"]').value = requestBody.email;
        fallbackForm.querySelector('textarea[name="level2Payload"]').value = JSON.stringify(level2Payload);

        const fallbackData = new FormData(fallbackForm);
        try {
          await fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(fallbackData).toString()
          });
        } catch (fallbackErr) {
          console.error("Netlify fallback form error:", fallbackErr);
        }
      }

      // Display success to candidate
      if (candidateGreetingCard) candidateGreetingCard.style.display = "none";
      if (formContainer) formContainer.style.display = "none";
      if (submissionBanner) {
        submissionBanner.hidden = false;
        submissionBanner.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});
