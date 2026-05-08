# PSP Hiring

Pet Supplies Plus Battle Creek hiring application and manager admin console.

## What lives here

- Public applicant experience
- Manager admin dashboard
- Netlify Functions for shared applicant intake and manager review state
- Hiring assets and rollout docs for the PSP store hiring workflow

## Live sites

- Public application: `https://psp.battlecreekjobs.app`
- Manager admin: `https://psp.battlecreekjobs.app/admin.html`

## Local development

From this folder:

```bash
npm run serve
```

Open:

- `http://localhost:4173/index.html`
- `http://localhost:4173/admin.html`

For code checks:

```bash
npm test
```

## Key project files

- `index.html`: public hiring application
- `admin.html`: manager dashboard
- `app.js`: shared frontend logic
- `netlify/functions/`: intake, admin, auth, and config endpoints
- `GO_LIVE.md`: operational go-live checklist

## Current hiring defaults

- Starting pay: `$13.73/hour`
- Weekly target: `12-35` hours
- Weekends required
- Evenings preferred
- Interview booking via Google Calendar

