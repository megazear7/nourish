# Nourish

A simple calorie tracker. Three quick-add buttons, saved meals, a daily goal, and a seven-day weighted color.

Today counts fully. Yesterday counts half. Each older day counts a little less, down to one seventh six days back. Eating under the goal pulls the color back toward green. 150 over the weighted window is yellow. 300 over is red.

## Offline

Nourish is an installable PWA. The first visit stores the app shell on the device. After that, today, history, meals, and the goal all open with no connection, including a refresh on `/history`, `/meals`, or `/goal`. The open log stays in `localStorage` (`nourish-state`). Unsent changes stay in `nourish-queue`. Fonts and icons are part of the app.

Sign-out does not wipe the device. Switching accounts stashes the previous account on this device and never uploads that account's queue to the new one.

## Account

The header icon opens the menu. Signed out, the top offers Log in and Sign up. Signed in, your name stays at the top and Sign out sits at the bottom of the menu.

Auth0 is a bundled SPA (`@auth0/auth0-spa-js`), with refresh tokens in localStorage. The access token is sent as `Authorization`. The ID token is sent only as `X-ID-Token` when saving activity. Login count increments on an interactive login (the redirect callback), not when a silent token refresh opens the app.

If `AUTH0_DOMAIN` or `AUTH0_CLIENT_ID` is missing at build time, Log in explains that sign-in is not configured. Today still works. Those two values are copied into the browser bundle when Netlify builds, so a deploy preview built before they were saved has to be rebuilt.

## Sync

Each create, edit, or delete is its own queued request. `POST /api/ops` appends those requests. A repeated `opId` is an acknowledgement, not a second change. The server folds by `occurredAt`, then `opId`, and returns that user's log. The client replaces local state with that payload and only redraws requests that are still unacknowledged.

`GET /api/state` runs when the queue is empty. The service worker does not cache `/api/`.

Goals are their own rows. Today uses the newest `setAt`. A history day uses the newest goal whose `setAt` is on or before the end of that local day. An old single `goal` object is migrated once into one row.

The first login for a device backfills creates (and removes, for rows already deleted) with `count: false`, so activity totals do not jump. Activity is a private identity document at `activity/{deviceId}`: `loginCount`, `lastLoginAt`, `mealsCreated`, `entriesCreated`, `goalUpdates`, `currentGoal`, `updatedAt`.

## Stack

TypeScript, Zod, and Lit. Netlify serves `dist/client` and the `/api/ops` and `/api/state` function. SQL is Netlify Database / Neon. Local `npm start` uses a JSON file in `data/` so sync can be exercised without a database.

## Run

```
nvm use 22
npm install
cp .env.example .env
npm test
npm start
```

Open http://localhost:3000

`TEST_USERNAME` and `TEST_PASSWORD` are a real Auth0 database user. They stay in `.env` and are never written into the site. `npm run test:auth` exchanges them for an access token and calls `GET /api/state`. Set `NOURISH_BASE_URL` to a deploy preview to run that against the deployed API.

## Testing

`npm test` folds the log, checks rejected and duplicate ops, reloads the file store, and checks account stash / backfill ordering.

Local UI:

1. Open `/`. Today renders with no account. The header is a profile icon, not a hamburger.
2. Open the menu. Log in and Sign up are at the top. Today, History, Meals, and Goal stay below.
3. Add 50, 100, and 500. They stay after refresh. Signed in, they also survive a second browser pointed at the same API (the second device pulls `GET /api/state`).
4. Change a group's time from the clock. Delete with the trash control. Edit by tapping the calorie total. Five quick adds inside a minute are one bubble; saving that edit keeps one row and removes the others.
5. Create a meal from Meals. The row appears only after the check. Updating a meal does not rewrite entries already logged. History opens on the calendar. Days before the first log, and future days, are blank. The goal form check saves a new goal row; an older day keeps the older goal.
6. Go offline, add calories, come back. The queue flushes. Sign out. The log remains.

Deploy preview:

1. Open the preview URL from the pull request. Confirm `/` loads and `/api/state` without a token returns 401 JSON, not the HTML shell.
2. Log in and Sign up from the menu. The return URL is the preview origin, with no `code` left in the address bar. If the menu says sign-in is not configured, the preview was built before `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` existed. Retry the deploy.
3. On two browsers, add food as the same user. The later `occurredAt` wins even if the older edit arrives second. A second goal is a new row. History days use the goal that was in effect that day.
4. In the identity console, Nourish shows entries, meals, logins, the current goal, and last login. Open Nourish uses `NOURISH_ORIGIN`. Deleting Nourish there removes those totals only. The food log is still on the preview after refresh.

`npm run test:auth` does the same token check with `TEST_USERNAME` and `TEST_PASSWORD` against localhost, or against `NOURISH_BASE_URL`.

## Auth0 and Netlify

Create one Auth0 **Single Page Application** for Nourish. No client secret in the browser.

Allowed Callback URLs, Logout URLs, Web Origins, and CORS, comma-separated as Auth0 requires:

- `http://localhost:3000`
- the deploy-preview origin (changes per pull request)
- the production origin once it exists

Enable the Database connection and signups. API identifier: `https://identity.megazear7.com`. Refresh token rotation can stay on.

On the Nourish Netlify site:

| Variable | Where | Purpose |
| --- | --- | --- |
| `AUTH0_DOMAIN` | build and runtime | Tenant host, no `https://`. Comma-separate the custom domain and the tenant host if tokens can use either. |
| `AUTH0_CLIENT_ID` | build | SPA client id |
| `AUTH0_AUDIENCE` | build and runtime | `https://identity.megazear7.com` |
| `AUTH0_ISSUER_DOMAINS` | runtime | Optional extra issuer hosts |
| `NOURISH_IDENTITY_URL` | build | Defaults to `https://identity.megazear7.com/data` |
| `NETLIFY_DB_URL` | runtime | Created when Netlify Database is enabled. The migration is `netlify/database/migrations/20261009120000_nourish_log.sql`. |

`AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` are read when the browser bundle is built. Changing them requires a new deploy. `TEST_USERNAME` and `TEST_PASSWORD` are only for `npm run test:auth`. Do not put them in the browser bundle.

On the identity site (`megazear-users`):

- Add the Nourish origins to `AUTHORIZED_ORIGINS`.
- If `AUTH0_ALLOWED_CLIENT_IDS` is set, add this SPA's client id.
- Set `NOURISH_ORIGIN` to the Nourish origin so the console can link to it. Leave it empty to hide the open link.

Access tokens do not include email unless an Auth0 Action adds it. The user row still works with a null email.
