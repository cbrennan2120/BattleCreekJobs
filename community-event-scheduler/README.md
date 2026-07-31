# PSP Battle Creek Community Event Scheduler

Public scheduling for the shared community event space at Pet Supplies Plus Battle Creek. Visitors can see open times and confirmed group names without creating an account. Contact details remain available only in the protected staff dashboard.

## What is implemented

- Responsive PSP-branded week and list views
- Rescue, community event, birthday/private party, VIP vaccine clinic, and dog trainer categories
- Consecutive 30-minute reservations from 30 minutes through four hours
- 24-hour notice and 90-day booking horizon in `America/Detroit`
- Ten-minute atomic holds with six-digit email verification
- Private cancellation/rescheduling links
- Shared-passcode staff dashboard with full contact details, hours, blackouts, and audit history
- Turnstile, database-backed rate limits, secure cookies, CSRF checks, hashed tokens, and explicit public response projections
- Netlify Database migrations and a five-minute expired-hold cleanup function

## Local development

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

The Netlify Vite plugin exposes Functions and Netlify primitives through the Vite development server. For a database, use a Netlify development database or put a Postgres-compatible Supabase connection string in `DATABASE_URL`.

Generate a staff passcode hash without storing the passcode in source control:

```powershell
node -e "import('bcryptjs').then(async ({default:b}) => console.log(await b.hash('replace-with-passcode', 12)))"
```

Generate a session secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

For local-only email testing, set `MAIL_MODE=console`. This mode is never accepted on a Netlify runtime.

## Required Netlify configuration

Create a new Git-connected Netlify project from `cbrennan2120/BattleCreekJobs` with:

- Base directory: `community-event-scheduler`
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Production branch: `main`

Set these environment variables in Netlify, not in Git:

- `RESEND_API_KEY`
- `FROM_EMAIL`
- `STAFF_NOTIFICATION_EMAIL`
- `ADMIN_PASSCODE_HASH`
- `SESSION_SECRET`
- `TURNSTILE_SECRET_KEY`
- `VITE_TURNSTILE_SITE_KEY`

Installing `@netlify/database` lets an eligible credit-based Netlify account provision the managed Postgres database. Migrations under `netlify/database/migrations/` are applied to isolated deploy-preview branches and production automatically. If Netlify Database is unavailable, set `DATABASE_URL` to the Supabase Postgres connection string; the data layer and migrations remain unchanged.

## API privacy contract

Public availability returns only slot start/end, state, confirmed group name, and category. Pending reservations expose only `pending`. Public responses never select or serialize contact name, email, phone, private notes, token hashes, verification codes, or audit data.

The owner management route requires a random private token. Every staff data route requires a valid HttpOnly session cookie; write operations also require the matching CSRF header.

## Verification

```powershell
npm.cmd run check
```

The suite covers slot boundaries, hours, duration, notice/horizon rules, blackouts, daylight-saving dates, pending-booking privacy, public contact-data redaction, logo dimensions, and the database uniqueness constraint that prevents two bookings from claiming the same resource/time slot.

Before production activation:

1. Review the Netlify deploy preview on desktop and mobile.
2. Confirm Netlify Database and migrations are healthy.
3. Configure Resend with a verified sender domain and send a real verification email.
4. Configure Turnstile for the preview and final Netlify hostnames.
5. Set the staff passcode hash and test sign-in, CSRF, logout, and session expiry.
6. Run two simultaneous booking attempts against the preview database and confirm one receives HTTP 409.
7. Have PSP Marketing review the branded public page before assigning a custom domain.
