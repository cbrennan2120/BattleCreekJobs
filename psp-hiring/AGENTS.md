# AGENTS.md — PSP Hiring Application & Admin System (`psp-hiring`)

This document is the authoritative guide for AI agents working inside `psp-hiring/` (`psp.battlecreekjobs.app`).

---

## 1. Store #0212 Hiring Business Rules

- **Store**: Pet Supplies Plus Store #0212 (Battle Creek, MI)
- **Address**: 1791 W. Columbia Ave, Battle Creek, MI 49015
- **Positions Hired Externally**:
  - `Stock Team Member`: Stocking shelves, heavy carry-outs (up to 50 lbs), store recovery, ladders, cleaning.
  - `Cashier Team Member`: Front checkout register, neighbor interaction, register reconciliation, animal care support.
  - **Service Team Member**: **NEVER hired externally.** Service Team Members and shift leads are promoted from within the Stock/Cashier team.
- **Pay Rate**: **\$13.73 / hour** starting wage (Michigan minimum wage base).
- **Raises**: Team members are eligible for reviews and **raises twice a year up to 5%** based on reliability and store performance.
- **Hours**: **Part-time only (12–35 hours/week)**. Saturday and Sunday availability are mandatory for store operational coverage; evenings are preferred.
- **Store Notification Email**: **`psp0212@petsuppliesplus.com`** (must be notified automatically upon Level 1 and Level 2 submissions).
- **Google Calendar Scheduling**: `https://calendar.app.google/nijf5P59jCSbdGcX8`

---

## 2. PSP Brand Design Rules (`psp-brand`)

1. **Logo**:
   - Always reference `assets/psp-logo-white-on-green.png`.
   - **Never reconstruct the logo using typed HTML/CSS text.**
   - Maintain clear space equal to the height of the letter `P` around the logo.
2. **Typography**:
   - Headlines: `Verb Black` (`assets/fonts/VerbBlack.otf`)
   - Subheadings: `Foco Bold` (`assets/fonts/Foco-Bold.ttf`)
   - Body & Form Text: `Foco Regular` / `Foco Light` (`assets/fonts/Foco-Regular.ttf`, `assets/fonts/Foco-Light.ttf`)
3. **Color Palette**:
   - Primary Green: `#00AF41` (Pantone 354 C)
   - Accent Deep Green: `#007A2E`
   - Light Tint: `#F4FAF5`
   - Dark Neutral: `#222222` (Charcoal body text)
   - Status Badges: Top Match (`#00AF41`), Follow-up/Level 2 (`#872D91`), Category/Pills (`#0098CE`), Caution (`#F6BE00`), Alert/Flag (`#E31C21`).

---

## 3. Serverless Backend & Storage Map

All backend functions run on Netlify Serverless (`netlify/functions/`):

- **Intake Endpoints**:
  - `POST /api/apply` (`application-intake.mjs`): Saves Level 1 applicant payload to Netlify Blobs (`psp-hiring-intake`) and triggers email alert to `psp0212@petsuppliesplus.com`.
  - `POST /api/level2` (`level2-intake.mjs`): Attaches Level 2 payload directly to the candidate's record in `psp-hiring-intake`, advances stage to `full_completed`, and emails `psp0212@petsuppliesplus.com`.
- **Admin Management**:
  - `GET/PATCH/DELETE /api/admin/applicants` (`admin-applicants.mjs`): Authenticated queue retrieval and stage updating.
  - `GET/POST /api/admin/config` (`store-config.mjs`): Live store hiring configuration.
  - `POST /api/admin/login` / `GET /api/admin/session` / `POST /api/admin/logout`: Passcode-gated manager session.

---

## 4. Verification

After making any changes:

```powershell
npm test
```

This verifies JavaScript syntax and Netlify function imports before deployment.
