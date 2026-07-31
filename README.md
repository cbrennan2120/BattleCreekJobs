# BattleCreekJobs

Monorepo for the Battle Creek Jobs project family.

## Projects

### `psp-hiring/`
Pet Supplies Plus Battle Creek hiring application and manager admin console.

Live:

- `https://psp.battlecreekjobs.app`
- `https://psp.battlecreekjobs.app/admin.html`

### `battlecreekjobs-splash/`
Public-facing Battle Creek Jobs splash site and "coming soon" landing page.

Live:

- `https://battlecreekjobs.app`

### `community-event-scheduler/`
Pet Supplies Plus Battle Creek public community-event scheduler and private staff dashboard.

- 30-minute public availability and email-verified reservations
- Admin-only contact information, weekly hours, blackouts, and audit history
- React/Vite, Netlify Functions, and Netlify Database/Postgres
- Production URL will be assigned after the deploy preview is approved

## Repo notes

- Secrets stay local and must not be committed
- Production deploys should be batched and intentional
- PSP hiring changes and splash-site changes now share one GitHub history
