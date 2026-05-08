# Live Rollout

## Current deployment strategy

Use the static app first, then add live intake through Netlify without changing the applicant experience.

## Planned live behavior

1. Applicant completes the multi-step form
2. App scores the candidate locally for immediate manager review behavior
3. Deployed site posts a copy of the application to the Netlify form `battle-creek-application`
4. Manager reviews qualified candidates and sends the Google Calendar booking link

## Page structure

1. Public applicant page: `/index.html`
2. Manager dashboard: `/admin.html`

## Google Calendar workflow

Booking page:

- [PSP BC Interviews](https://calendar.app.google/nijf5P59jCSbdGcX8)

Owner:

- `cbrennan2120@gmail.com`

Interview settings:

1. Tuesdays `3:00 PM - 4:00 PM`
2. Fridays `3:00 PM - 4:00 PM`
3. `20-minute` interviews
4. `10-minute` buffer
5. Effective weekly capacity: `4 interviews`

## Launch checklist before deployment

1. Final browser QA
2. Confirm copy and fields
3. Confirm Netlify site target
4. Confirm whether notifications should route through Netlify, Gmail, or manual review
5. Deploy only after approval
