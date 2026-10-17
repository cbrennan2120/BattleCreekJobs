# AGENTS.md — Battle Creek Jobs Monorepo Guide

Welcome to the **Battle Creek Jobs** repository (`cbrennan2120/BattleCreekJobs`). This document serves as the single source of truth for AI agents (Antigravity, Codex, Claude, etc.) working on this codebase.

---

## 1. Monorepo Structure & Local Workspace

- **Local Git Repository**: `C:\Users\BCPets\Documents\New project 2\`
- **GitHub Remote**: `https://github.com/cbrennan2120/BattleCreekJobs.git` (Default branch: `main`)
- **Notice on Local Files**: The local workspace root contains operational retail store files for Pet Supplies Plus Store #0212 (e.g., schedules, SOPs, checklists). **Never delete, overwrite, or commit these untracked local documents.**

### Project Directories

```
BattleCreekJobs/
├── psp-hiring/                    # Pet Supplies Plus Battle Creek Hiring Hub & Admin
│   ├── index.html                 # Level 1 Public Application
│   ├── apply.html                 # Application intake wrapper
│   ├── level2.html                # Level 2 Follow-up Application
│   ├── admin.html                 # Manager Admin Console
│   ├── app.js                     # Core frontend logic & manager console scripts
│   ├── level2.js                  # Level 2 submission & smart prefill logic
│   ├── styles.css                 # PSP brand styling & responsive layout
│   ├── assets/                    # Official brand assets (logos, fonts)
│   ├── netlify/functions/         # Serverless API endpoints & Blobs handlers
│   └── PSPNewHire/Orientation/    # Store #0212 New Hire Orientation slide viewer
│
├── battlecreekjobs-splash/        # Public splash landing page (https://battlecreekjobs.app)
│
└── community-event-scheduler/     # Community space event booking system (React/Vite/TS/Postgres)
```

---

## 2. Live URLs & Production Hosting

| Project | Live URL | Netlify Site ID |
| :--- | :--- | :--- |
| **PSP Hiring Portal** | `https://psp.battlecreekjobs.app` | `059547eb-aa7d-4085-bac3-00c20861480f` |
| **Manager Admin Console** | `https://psp.battlecreekjobs.app/admin.html` | `059547eb-aa7d-4085-bac3-00c20861480f` |
| **Level 2 Application** | `https://psp.battlecreekjobs.app/level2.html` | `059547eb-aa7d-4085-bac3-00c20861480f` |
| **Store 212 Orientation** | `https://psp.battlecreekjobs.app/PSPNewHire/Orientation/` | `059547eb-aa7d-4085-bac3-00c20861480f` |
| **Splash Page** | `https://battlecreekjobs.app` | Netlify Hosted |
| **Community Scheduler** | *Awaiting custom domain assignment* | Separate Netlify project |

---

## 3. Store #0212 Locked-In Hiring Rules

Any agent modifying `psp-hiring` **must** adhere strictly to these operational requirements:

1. **Roles Hired Externally**:
   - Only hire for **Stock Team Member** and **Cashier Team Member**.
   - **Never hire Service Team Members externally.** Service Team Members and leadership roles are cross-trained and promoted internally from the Stock and Cashier team.
2. **Compensation & Growth**:
   - Starting pay is **\$13.73 / hour** (Michigan minimum wage base).
   - Team members are eligible for **biannual performance reviews and raises twice a year up to 5%**.
3. **Schedule & Availability**:
   - **Part-time only (12–35 hours/week)**.
   - Weekend availability (Saturdays and Sundays) is required for store coverage; evenings are preferred.
4. **Store Notification Email**:
   - Automated application alerts for both Level 1 and Level 2 go to **`psp0212@petsuppliesplus.com`**.
5. **Interview Scheduling**:
   - In-person 20-minute interviews are booked via Google Calendar: `https://calendar.app.google/nijf5P59jCSbdGcX8`.
   - Store Location: `1791 W. Columbia Ave, Battle Creek, MI 49015`.

---

## 4. Official Pet Supplies Plus Brand Standards (`psp-brand`)

All UI, emails, and printable documents must follow the official `psp-brand` design guidelines:

- **Authoritative Logo**: Always use `assets/psp-logo-white-on-green.png`. **Never recreate the logo using typed HTML/CSS text.** Maintain clear space equal to the height of the `P` around the logo.
- **Brand Typography**:
  - Headlines & Display: `Verb Black` (`assets/fonts/VerbBlack.otf`)
  - Subheads & Section Titles: `Foco Bold` (`assets/fonts/Foco-Bold.ttf`)
  - Body Copy: `Foco Regular` & `Foco Light` (`assets/fonts/Foco-Regular.ttf`, `assets/fonts/Foco-Light.ttf`)
- **Brand Color Palette**:
  - Primary Identity: Pantone 354 C Green (`#00AF41`)
  - Forest Accent: Deep Accent Green (`#007A2E`)
  - Light Tint: PSP Green Tint (`#F4FAF5`) for callouts and table rows
  - Dark Neutral: Charcoal (`#222222`) on white (`#FFFFFF`) for readability
  - Semantic Status: Yellow (`#F6BE00`), Blue (`#0098CE`), Purple (`#872D91`), Red (`#E31C21`).

---

## 5. Data Storage Architecture (Netlify Blobs)

The hiring app uses **Netlify Blobs** for serverless storage:

- **`psp-hiring-intake`**: Contains applicant records (`submissions/{id}.json`). Stores Level 1 contact details, 7-day availability matrix, scoring breakdown, and merged Level 2 answers.
- **`psp-hiring-admin`**: Contains manager pipeline state (`reviews/{id}.json`) including stages (`new`, `sent_full`, `full_completed`, `interviewing`, `hold`, `declined`, `hired`, `archived`), manager notes, and review timestamps.
- **`psp-hiring-config`**: Contains store settings (`store-config.json`) including pay rates, hour limits, scheduling link, notification email, and email templates.

---

## 6. Development & Verification Commands

Inside `psp-hiring/`:

```powershell
# Run syntax and integrity checks across JS and Netlify functions
npm test

# Local development server via Netlify CLI
npm run dev

# Or simple static server
npm run serve
```

Always verify syntax with `npm test` before committing any changes.
