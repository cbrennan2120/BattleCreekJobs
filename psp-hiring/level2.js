document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("level2-form");
  const formContainer = document.getElementById("form-container");
  const submissionBanner = document.getElementById("submission-banner");
  const submitButton = document.getElementById("submit-level2");

  // Handle Smart Link Prefill
  const urlParams = new URLSearchParams(window.location.search);
  const prefillName = urlParams.get("name");
  const prefillEmail = urlParams.get("email");

  if (prefillName) {
    const nameInput = document.getElementById("fullName");
    if (nameInput) nameInput.value = prefillName;
  }
  if (prefillEmail) {
    const emailInput = document.getElementById("email");
    if (emailInput) emailInput.value = prefillEmail;
  }

  // Clear error styles on input
  form.addEventListener("input", (e) => {
    if (e.target.classList.contains("error-highlight")) {
      e.target.classList.remove("error-highlight");
      const errorMsg = e.target.parentNode.querySelector(".error-message");
      if (errorMsg) errorMsg.remove();
    }
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Clear previous custom errors
      document.querySelectorAll(".error-message").forEach(el => el.remove());
      document.querySelectorAll(".error-highlight").forEach(el => el.classList.remove("error-highlight"));

      if (!form.checkValidity()) {
        // Find the first invalid element
        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid) {
          // Highlight invalid fields
          form.querySelectorAll(":invalid").forEach(el => {
            el.classList.add("error-highlight");
            // Add a small text message
            if (!el.parentNode.querySelector(".error-message")) {
              const msg = document.createElement("span");
              msg.className = "error-message";
              msg.textContent = "This field is required.";
              el.parentNode.appendChild(msg);
            }
          });

          // Smooth scroll to the first invalid element
          firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
          firstInvalid.focus({ preventScroll: true });
        }
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";

      const formData = new FormData(form);
      const dataObj = {};

      for (const [key, value] of formData.entries()) {
        if (dataObj[key]) {
          if (!Array.isArray(dataObj[key])) {
            dataObj[key] = [dataObj[key]];
          }
          dataObj[key].push(value);
        } else {
          dataObj[key] = value;
        }
      }

      const netlifyForm = document.forms["level2-application"];
      const netlifyData = new FormData(netlifyForm);
      
      netlifyData.set("form-name", "level2-application");
      netlifyData.set("bot-field", "");
      netlifyData.set("level2Payload", JSON.stringify(dataObj, null, 2));

      try {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(netlifyData).toString()
        });

        if (response.ok) {
          formContainer.hidden = true;
          submissionBanner.hidden = false;
          window.scrollTo(0, 0);
        } else {
          console.error("Form submission error", response.status);
          alert("There was an issue submitting your application. Please try again.");
          submitButton.disabled = false;
          submitButton.textContent = "Submit Application";
        }
      } catch (error) {
        console.error("Form submission error", error);
        alert("There was an issue submitting your application. Please check your connection and try again.");
        submitButton.disabled = false;
        submitButton.textContent = "Submit Application";
      }
    });
  }
});
