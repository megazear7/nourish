# Nourish features

Exhaustive description of how the Nourish app works. The behavior sections were taken from the `main` branch (tree `f07482101ee755a961c136fe0811a85279a04a1e`, last pushed 2026-10-10). This file describes behavior in the source. It is not a roadmap.

The running app is a single custom element, `<nourish-app>`, defined in [src/client/app.ts](src/client/app.ts). Rollup’s only entry is that file, so the browser bundle does not include the older view components listed at the end.

## Goal

Nourish is a very simple calorie tracker. It is meant to be as efficient as possible at tracking calories, with no extra weight or bloat in the UI.

A person should be able to keep their calories up to date with as few clicks and as few decisions as possible. Tracking has to stay so light that they do not stop because the app was slightly too hard to use, or because writing one thing down took slightly too long.

That goal outranks new surface area. A control, a step, or a decision that is not required to log calories is a cost. Do not add one unless the task is explicitly to add it. When behavior does change, update this file in the same change.

## Keeping this file current

Read this file before changing the app. It is the source of truth for pages, buttons, routes, copy, storage, sync, and scoring.

If a change adds, removes, or alters any of that, update the matching part of this file in the same change. Do not leave it stale. Do not describe a feature here that the code does not implement.

Agents are told to do this from `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and `.cursor/rules/nourish.mdc`. Those files point here. This file is the behavior reference.

Those five files are one instruction set. When any of them changes, the same change is written into the other four in the same commit. A new tool's instruction file is added to that list everywhere. Relative links to this file may differ. The instructions may not.

## What it is

Nourish is a calorie log. It is not a macro tracker, meal planner, or food database.

A person can:

- Add 50, 100, or 500 calories with one tap.
- Log a saved meal, which copies that meal’s calories, title, and description onto the log row.
- Name a plain calorie row later without creating a saved meal.
- Change when a row was eaten, edit its calories, or mark it removed.
- Look back through a calendar or a 30-day list, and open any past day to log into that day.
- Set a daily calorie goal. Goals are a history of rows, not one mutable number. A past day keeps the goal that was in effect that day. From a day page, one day can be given its own goal without changing the others.
- See one color for the day, from a seven-day weighted sum of how far each day sat from the goal.
- Use the app with no account. The log stays in `localStorage`.
- Sign in and sync that log across browsers. Offline edits queue and upload later.
- Install it as a standalone portrait PWA. After the first visit, the shell, fonts, and icons open with no network. The food API is never cached by the service worker.

Production is a static site on Netlify (`dist/client`) plus the food JSON endpoints `GET /api/state` and `POST /api/ops`, and the competitions endpoints under `/api/competitions`, backed by Netlify Database / Neon. Local `npm start` uses the same API against a JSON file in `data/`.

## What it does not do

There is no barcode scan, photo estimate, food search, USDA lookup, protein, fat, carb, fiber, water, weight, or fasting clock. There is no household and no shared food log. Competitions share a standing only: the day label, points, and who is still in. They do not share meals or calorie totals. There is no export button, no import, no undo toast, and no confirm dialog before remove. There is no settings screen. Sign-out does not delete the device log. Deleting the Nourish activity document in the Megazear identity console does not delete the food log. The app does not edit a goal in place and does not rewrite log rows when a saved meal later changes.

## Routes

Navigation is `history.pushState` plus a `popstate` listener. There is no router library. Every in-app navigation also closes the menu, the meal picker, any open kebab, and the edit sheet.

| URL | Page id | Header title | What renders |
| --- | --- | --- | --- |
| `/` and any path that does not match below | `today` | Today | Today summary, today’s rows, bottom dock |
| `/history` and `/history/…` | `history` | History | Calendar (default) or list |
| `/day/YYYY-MM-DD` when that key is a real local date | `day` | Today, Yesterday, or `Tue, Oct 6` style | That day’s summary, rows, and the same bottom dock |
| `/day/…` that is not a real date | `history` | History | History. The bad URL is left as-is |
| `/meals` and `/meals/…` except the new-meal path | `meals` | Meals | Saved meals |
| `/meals/new` and `/meals/new/…` | `new-meal` | New meal | Create-meal form |
| `/meal/{id}` | `meal` | Edit meal | Edit form, or “That meal is no longer here.” |
| `/goal` and `/goal/…` | `goal` | Goal | Goal form |
| `/competitions` | `competitions` | Competitions | Competition list, or the signed-out / offline note |
| `/competitions/new` and `/competitions/new/…` | `new-competition` | New competition | Create form |
| `/competitions/{uuid}` | `competition` | Last one standing or Best of the month | That competition |
| `/competitions/{not-a-uuid}` | `competitions` | Competitions | The list. The bad URL is left as-is |
| `/profile` and `/profile/…` | `profile` | Profile | Profile picture, email, and display name |

`/meal` with no id does not match the meal pattern, so it renders Today while the address bar still says `/meal`. The same is true of any unknown path such as `/settings`.

The word **Nourish** in the header is a link. Clicking it calls `preventDefault` and navigates to `/`.

The service worker answers document navigations from the cached `index.html`, including a refresh on `/history`, `/meals`, `/goal`, `/profile`, `/competitions`, `/day/…`, or `/meal/…`. `/api/` is never cached.

## Shell

`index.html` paints `#070911` on `html` and `body` before JavaScript, then mounts `<nourish-app>` and loads `/bundle.js`. The element renders in an open Lit shadow root, so its CSS does not apply to the page and the page CSS does not apply inside it. All UI CSS lives in [src/client/styles.global.ts](src/client/styles.global.ts).

The host is at least one viewport tall. Background is `#0c0d18` with a soft gold radial glow at the top. Content column max width is `45rem` (`--content`). Typeface is Inter (bundled `woff2`, weights 300–700, latin), then Segoe UI, then sans-serif.

### Header

- Small gold uppercase wordmark **Nourish**, letter-spacing `0.22em`.
- Large page title under it (`1.6rem`). The title is the only `<h1>` and changes with the page. History’s inner heading “Days” is an `<h2>`, separate from this title.
- Round menu button, top right, `2.75rem`, panel color `#171924`, `aria-label="Account and menu"`, `aria-haspopup="dialog"`, `aria-expanded` follows whether the sheet is open.
  - Signed out, or still checking, or auth not configured: stroke icon of a person in a circle. This is not a hamburger. The `.hamburger` CSS rules are unused.
  - Signed in with an Auth0 `picture`: that image, `object-fit: cover`, empty alt.
  - Signed in without a picture: initials. Source is the name shown in the menu: the local display name, else the Auth0 display name, else `email`, else `?`. Split on whitespace or `@`. First character of the first two parts, uppercased. One word yields one letter.

On viewports `54rem` and narrower, header text is padded on the right so it does not run under the button.

### Status lines

Both use class `offline-note` (gold, `0.85rem`) and `role="status"`.

- If `navigator.onLine` is false: **Offline. Your log stays on this device.**
- If `syncNote` is non-empty, a second line shows that string. It is cleared to empty after a clean sync.

`syncNote` is set to:

- `Sign in again to sync.` when `getTokenSilently` fails with `login_required`, `missing_refresh_token`, or `invalid_grant`, or the API returns 401. Any other token failure, including a network error, sets `Sync failed.` instead. That line is a button (`.sync-reauth`): the same gold type, underlined, no chrome. It closes the menu if it is open and calls the same redirect as **Log in**. It does not log out first. Every other note stays plain text.
- `Sync failed.` or `Sync failed (NNN).` on other failures.
- `N change could not sync.` / `N changes could not sync.` when one or more ops in the batch are `rejected`. Applied and duplicate ops are still dropped from the queue.
- `Food log synced. Activity totals could not be saved.` when `/api/ops` or `/api/state` succeeded and the identity PUT failed, and no other note was set.
- `Sign-in is not configured for this build yet.` when Log in or Sign up is pressed and `AUTH0_DOMAIN` or `AUTH0_CLIENT_ID` was empty at build time.

Online/offline is tracked with `window` `online` and `offline` events. Coming online flushes the queue if signed in.

### Side menu

Opening the menu closes any kebab and the edit sheet. The sheet is mounted first with the panel off-screen, then opened on a double `requestAnimationFrame` so the slide can run. Closing sets `is-open` off and unmounts after 320ms, or immediately when `prefers-reduced-motion: reduce`. A second open while the close timer is running just sets `is-open` again.

- Full-screen hit target. Clicking the dim layer closes the menu. Clicking the panel does not.
- Dim is `rgba(6, 7, 12, 0.55)`, fading in over 240ms.
- Panel slides from the right, 280ms, `cubic-bezier(0.22, 1, 0.36, 1)`, width `min(22rem, 88vw)`, background `#171924`, padding `1.4rem`. Reduced motion disables both transitions.
- Top block, under a hairline:
  - `checking`: **Checking account…**
  - `signed-in`: one button, class `account-link`, no border, no background, full width of the block. The label is left aligned and a muted chevron sits on the right (the same right-pointing path as the calendar’s next month). The label is the local display name for this Auth0 `sub` when [nourish-display-name](#localstorage-keys) has one, else the Auth0 display name, else the email, else **Signed in**. The Auth0 display name is `name` when that value is set and is not the email address (comparison ignores case and surrounding space). If `name` is missing or is the email, `given_name` and `family_name` are joined with a space and used on the same rule. If that is also missing, `nickname` is used unless it is the email or the email’s local part, which is what Auth0 fills in automatically. Long labels ellipsize. The button’s accessible name is `Profile, {label}`. Clicking it calls `navigate("profile")`, which closes the menu. No second line. No avatar in the panel.
  - otherwise: **Log in** (gold pill) and **Sign up** (transparent pill, light border).
- Nav buttons, left aligned, `1.15rem`, no icons: **Today**, **History**, **Meals**, **Goal**, **Competitions**, then **Share**. Today, History, Meals, Goal, and Competitions each navigate and close the menu. Share is the next row in that list, not a separate footer.
  - The URL is the app root: `origin + "/"`, not the page you are on.
  - A phone or tablet (`pointer: coarse` and `hover: none`) with `navigator.share` opens the system share sheet. Title is **Nourish**, and the URL is that root. Dismissing the sheet does nothing else. A successful share closes the menu. If the sheet fails for another reason, it falls through to copy.
  - Desktop, and any device without the share sheet, copies that URL. The button label becomes **Copied** for 1.6 seconds. The menu stays open. If the clipboard API refuses, it falls back to selecting a hidden textarea and `document.execCommand("copy")`.
- Bottom button only when signed in. It sits at the bottom of the panel (`margin-top: auto`), below Share, outline pill, muted text.
  - Usually **Sign out**. It closes the menu, calls Auth0 logout back to this origin, and sets the in-memory account to signed out. It does not clear `nourish-state`, the queue, the activity document, or `nourish-display-name`.
  - When the status line is **Sign in again to sync.**, that button reads **Re-authenticate**. It closes the menu and calls the same `loginWithRedirect` as **Log in**. It does not log out.

There is no close button. There is no link to a day, a meal, or new-meal. Profile is not a row in that list. It is only the account button.

## Profile (`/profile`)

Header title **Profile**. No dock. The bottom action buttons stay on Today and on a day page only.

- `checking`: **Checking account…** in `.empty-note`.
- Not signed in, including when auth is not configured: **Sign in from the menu to see your profile.** in `.empty-note`. No login buttons on this page.
- Signed in: a `form.goal-card.profile-card`.
  - Photo, `5.5rem` circle, centered, class `profile-photo`. The same picture rules as the header button. When there is no Auth0 `picture`, the initials use the menu’s name. Empty alt on the image.
  - The email, centered and muted, class `profile-email`. The line is absent when the account has no email. It is not a control.
  - Label **Display name**, input `#profile-name`, classes `text-input profile-name`, `type="text"`, `autocomplete="name"`, `maxlength="80"`. The label and the field are centered. The field is at most `400px` wide and stays full width of the card below that. The value starts as the local override, or as the Auth0 display name when this `sub` has no override. It does not start as the email. Typing does not change the menu until the form is saved. A re-render keeps the caret because the value is bound with Lit `live`.
  - Gold check button, centered, `aria-label="Save display name"`, the same check icon as the goal form. The page stays put. There is no confirmation text. Pressing it scales the button to `0.92`. For 1.6 seconds after a save, the button turns the on-track green `rgb(111, 191, 132)` (the same value `toneColor` uses at or under the goal) with ink `#102116`. The background eases over 320ms. The check redraws over 360ms, the button scales from `0.92` to `1.08` and settles at `1` over 420ms, and a green ring expands to `1.65` and fades over 640ms. The easing is `cubic-bezier(0.22, 1, 0.36, 1)`. Then the button eases back to gold. Saving again removes the class for a frame so the motion runs again. `prefers-reduced-motion: reduce` skips the press scale, the pop, the redraw, and the ring. The button still turns green for those 1.6 seconds, with no transition.
  - Save trims the field. An empty value, or a value equal to the Auth0 display name, removes this `sub` from `nourish-display-name`. Any other trimmed value is stored for this `sub` only, up to 80 characters. The menu label and the header initials update on that save. Nothing is sent to Auth0 or to the food API. Another account on this device keeps its own name.

## Today

Rendered for page `today`.

Summary block:

- No kicker. The header already says **Today**. When the day is **On track**, or has no goal, that line is absent.
- If a goal applies to today and the status is **Drifting**, **Running hot**, or **Over the window**, that label appears alone (uppercase, muted, tracked). No em dash and no **Today**. See [Color](#color).
- Huge number (`4.4rem`) of today’s calorie total. Color is the tone color when a goal exists, otherwise `--ink` (`#f4efe6`). The total is not formatted with thousands separators.
- Beside it, a muted button. When a goal applies to today the line reads `/ {goal} calories` and only the number is the button, `aria-label="Change goal"`. The goal number is not formatted with thousands separators. The word **calories** is not a control. When today has no goal the button’s label is exactly `/ no goal set`, `aria-label="Set a goal"`. Either click calls `navigate("goal")`. The button uses `.goal-link`: no border, no background, inherited muted type.
- When `yellowCalories` for today is a number, a muted button under that calorie line reads **Aim for less than {n} calories today**, where `{n}` is that number with no thousands separators. The button uses `.aim-note`: no border, no background, inherited type at `0.95rem`, muted, left aligned, gold focus ring. Clicking it opens the [aim modal](#aim-modal). It is absent when today has no goal, and when the first logged total that leaves solid green is the goal or higher. A day page does not show it.

Rows: non-removed entries whose local date is today, passed through the bubble grouper, newest bubble first. There is no empty sentence. When today has no entries, the only empty control is a link-style button **Did you fast today?** See [Fast modal](#fast-modal). It uses `.fast-link`: no border, no background, muted, gold focus ring. When today is already marked fasted and has no entries, the button reads **I fasted today.** It is hidden when today has entries.

The bottom action dock is shown on Today and on a day page only.

Once today has at least one non-removed entry and a goal applies, the dock shows a muted left-aligned line just above the four buttons, shifted up `12px`: **{n} calories remaining**. `{n}` is `dayCalorieTarget` for today minus today’s logged total, with no thousands separators. That target is `yellowCalories` when the green line sits under the goal, and the goal otherwise, so earlier overages shrink what is left before you reach the number that turns Today yellow. When the total is over that target the line reads **{n} calories over**, using the positive difference. The line is absent when today has no entries, when today has no goal, and on every day page.

## A past or current day (`/day/YYYY-MM-DD`)

Same summary as Today, except the kicker is `formatDayLabel`:

- The local today key: **Today**
- Yesterday: **Yesterday**
- Otherwise the runtime locale’s short weekday, short month, and numeric day (for example `Tue, Oct 6`).

Status label and tone color use that day’s goal and a weighted window that ends on that day, not on today. When a goal applies, the kicker, em dash, and status label always appear, including **On track**. That includes this page when the date is today. Only the main Today page (`/`) drops the line while the status is **On track** or there is no goal, and shows a warning label alone when the status is **Drifting**, **Running hot**, or **Over the window**.

The goal control is the same button as Today. Clicking it does not navigate. It opens a modal, including when this URL is today’s date. Only the main Today page goes to `/goal`.

The modal reuses the edit sheet: dim layer `.edit-sheet`, dialog `.edit-modal`, `role="dialog"`, `aria-modal="true"`, labelled by `#day-goal-heading`. Clicking the dim layer closes it. `Escape` while focus is inside closes it. Clicking the form does not. Dismiss does not save.

- Heading **Goal for {label}**, where `{label}` is `formatDayLabel` for that day.
- One line: **Only this day. Other days stay the same.**
- Number input `#day-goal-calories`, `name="calories"`, `type="number"`, `min="1"`, `step="1"`, `inputmode="numeric"`, required. Prefilled with that day’s current goal, or empty when there is none.
- Gold check button, `aria-label="Save goal"`.

Save requires an integer greater than 0. It appends `{ id, calories, setAt, day }` where `day` is this page’s date key and `setAt` is now. It enqueues `goal.create` with that body and `occurredAt` equal to `setAt`, closes the modal, and stays on this URL. It does not push a history entry. No title, description, nudges, or color paragraph.

Empty copy: **Nothing logged this day.** followed by a `.fast-link` button, **Or did you fast today?** (**I fasted today.** when that date is marked fasted), including when the date is today. It opens the [Fast modal](#fast-modal) for that page’s date key. It is hidden when the day has entries. Today uses **Did you fast today?** instead, and has no empty sentence.

The dock is the same four buttons. Calories added here are not stamped “now”. See [When a new row is stamped](#when-a-new-row-is-stamped).

Future dates can be opened from the address bar. The summary still renders. Adds use the past-day stamper, which anchors at noon on that date. The calendar itself does not make future cells into buttons.

## Bottom dock

Fixed to the bottom, centered, max `45rem`. The four buttons are one row, equal columns, gap `0.55rem`. A gradient from the canvas covers the bottom so rows can scroll underneath. Main content has `7.5rem` of bottom padding, or `9.25rem` when the remaining line is showing. That line is a left-aligned `.remaining-note` above the button row, muted, `0.95rem`, shifted up `12px`. It is only rendered from Today, and only when today has a goal and at least one non-removed entry. See [Today](#today).

| Button | Label | Style | Action |
| --- | --- | --- | --- |
| 1 | `+50` | Gold `#d7b07a`, ink `#1b140c`, min-height `3.4rem`, radius `1.1rem` | `addCalories(50)` |
| 2 | `+100` | same | `addCalories(100)` |
| 3 | `+500` | same | `addCalories(500)` |
| 4 | `Meals` | Panel background, light text. `aria-haspopup="menu"`, `aria-expanded` | Toggles the meal picker and closes any kebab |

There is no custom-calorie field on this dock.

### Meal picker

Opens above the Meals button (`bottom: 5.6rem`, or `7.4rem` when the remaining line is showing, right-aligned, max width `18rem`, max height `min(58vh, 26rem)`, scrolls). A transparent full-screen backdrop click closes it. Bubbles are pills.

1. **Create a new meal** — quieter styling, no shadow. Goes to `/meals/new`.
2. One bubble per saved meal that is not removed, in stored array order. A new meal is unshifted to the front. Dragging a card on the Meals page rewrites that order, and the picker follows it. Each bubble shows the title in title case and the calorie number. No unit word. Click logs `meal.calories` with `mealId`, and copies `title` and `description` onto the new entry. The picker closes.

Logging a meal does not change the saved meal. Later edits to the saved meal do not change rows already logged.

## Log rows

A “row” on screen is often one stored entry and sometimes several. Removed entries (`removed: true`) are hidden everywhere totals are computed. They stay in the array.

### Grouping plain adds

`QUICK_WINDOW_MS` is 60 seconds.

Non-meal entries (no `mealId`) are sorted oldest first. A group starts at the first of them. Later non-meal entries join while their timestamp is within 60 seconds of the **start** of that group, not of the previous tap. A gap larger than 60 seconds from the start opens a new group. Meal rows are never merged into a group. A meal row that falls between two plain adds does **not** reset the 60 second window; the plain adds still compare against the group start.

The bubble shows:

- `calories`: sum of the grouped entries.
- `timestamp`: timestamp of the **latest** entry in the group.
- `key`: entry ids joined with `:`.

Bubbles are then shown newest first.

Five taps of +50/+100/+500 inside one minute from the first tap become one bubble. That is the “one bubble” rule.

### Row layout

Panel card, tight padding, radius `0.95rem`. One line:

- Calorie total as a `<button class="log-calories">`. The cursor is `default` and the button has no focus outline. Clicking it opens the edit sheet. Keyboard activation still works because it is a button.
- The word **calories** in muted type.
- Time as a `<button class="log-time">`, muted, `hour:minute` in the runtime locale (`hour: "numeric"`, `minute: "2-digit"`). Click opens the clock.
- If the row has a title (see below), a title button. On screens wider than 720px it sits on this same line, ellipsized. At `720px` and below that inline title is `display: none`.

Under the line, only when there is a title:

- A second title button, `display: none` above 720px and shown at 720px and below, ellipsized.
- If this bubble is a meal log (`mealId` set) and the first grouped entry has a non-empty trimmed `mealDescription`, a one-line note. The note is hidden at 720px and below. Plain (non-meal) rows never show a description, even if a description was typed onto a meal and the meal id is missing.

Title source, in order: the first grouped entry that has `mealTitle`, otherwise the saved meal’s current `title` if `mealId` still matches a meal in state. Displayed through title case.

Title click:

- If the saved meal object still exists, go to `/meal/{id}`.
- If the title is only a snapshot (meal deleted, or the row was named without a meal), open the edit sheet.

### Kebab

A round icon button with three vertical dots, `aria-label="More options"`, `aria-haspopup="menu"`, `aria-expanded`. Toggles a menu for this bubble’s key. Opening it closes the meal picker and the side menu. A second tap, or a tap on the transparent backdrop, closes it. While open, the card gets `menu-open` so it stacks above siblings (`z-index: 8`).

Menu (`role="menu"`, min width `11rem`, `#222433`, shadow):

| Item | Icon | Action |
| --- | --- | --- |
| Edit | pencil | Open edit sheet |
| Change time | clock | Same as tapping the time |
| Remove | trash, color `#e7a29a` | Mark every entry in the bubble removed |

Remove does not ask. It sets `removed: true` on each grouped entry and enqueues one `entry.remove` per entry. The objects stay in `entries`.

### Clock

A visually hidden `<input type="time" step="60">` covers the time button (`opacity: 0`, `pointer-events: none`, `tabindex="-1"`, `aria-hidden="true"`). The visible time button calls `showPicker()` when the browser allows it. Failure is ignored. On `change`, every entry in the bubble is rewritten to that clock time on its **existing calendar day**:

- Hours and minutes from the input.
- Seconds and milliseconds set to 0.
- `entry.patch` body is `{ eatenAt }` only. The patch’s `occurredAt` is “now”, so it sorts after the original create.

Changing time does not move the row to another day. A grouped bubble shares one new timestamp across members, so they stay one bubble.

## Edit sheet

Opened from the calorie number, from Edit, or from a title that has no live meal. Any open menu closes first. Focus inside the app is blurred so the first field can take it.

Full-screen dim overlay (`z-index: 20`, `rgba(6, 7, 12, 0.62)`). Clicking the dim area closes without saving. `Escape` on the overlay closes without saving. Clicks inside the dialog do not close it. The dialog is `role="dialog"`, `aria-modal="true"`, labelled by the heading.

Heading:

- **Edit this serving** when the bubble has a `mealId`.
- **Edit calories** otherwise.

Fields:

| Field | Id | Meal row | Plain row |
| --- | --- | --- | --- |
| Title | `edit-use-title` | Required. Placeholder empty. Prefilled from entry `mealTitle` or the live meal title, title-cased | Optional. Placeholder **Optional**. Prefilled the same way |
| Description | `edit-use-description` | Textarea, 3 rows, from the latest entry’s `mealDescription` or the live meal description | Not shown |
| Calories | `edit-calories` | Number, `min="1"`, `step="1"`, `inputmode="numeric"`, required, large and centered. Prefilled with the bubble sum | Same |

Nudge buttons, not submitted:

- Left, field-colored: **−100**, **−25**, **−5**
- Right, gold: **+5**, **+25**, **+100**

The current field is parsed as a number. A non-finite value is treated as 0. The result is rounded and floored at 1. Nudges do not save by themselves.

Submit is a gold circle with a check, `aria-label="Save"`. No visible word “Save”.

Save rules:

- Calories must be an integer greater than 0. Otherwise nothing happens.
- The kept id is the **last** id in the bubble (the latest entry, because ids were collected in time order).
- Meal serving: title must be non-empty after trim. Title is title-cased. Description is trimmed and may be empty. One `entry.patch` on the kept id: `{ calories, mealTitle, mealDescription }`. The saved meal record is not updated. Other ids are not removed because a meal bubble has only one entry.
- Plain calories: optional title, title-cased. Empty title is stored locally as no `mealTitle` (`undefined`). The queued patch still sends `mealTitle` as `""` when the field is empty. Calories are written onto the kept entry. Every other entry in the bubble is marked removed and gets an `entry.remove`. One row remains. This is how a grouped +50/+100/+500 bubble collapses.

Closing the route, opening another page, or clicking the scrim calls `closeEdit` and drops the draft. There is no dirty-check prompt.

Title case: the whole string is lowercased, then any Unicode letter at the start or after a non-letter is uppercased. `chicken salad` becomes `Chicken Salad`. An apostrophe counts as a non-letter, so the next letter is capitalized too.

## When a new row is stamped

`addCalories` always creates a new UUID, appends an entry to the front of the local array, saves `localStorage`, and enqueues `entry.create` with `occurredAt` equal to the eaten timestamp.

- On Today, or on the day page when that day is today: timestamp is `new Date().toISOString()` at the tap.
- On a different day page:
  - If the previous add on this page was for the same day key and was less than 60 seconds of wall-clock time ago, the new row **reuses that exact timestamp** so the taps group into one bubble.
  - Otherwise `backfillTimestamp`:
    - No rows that day yet: local noon.
    - Otherwise 30 minutes after the latest existing timestamp that day.
    - If that latest time is 23:30 or later, the new stamp is 23:59 local, so it cannot roll into the next day.

Backfill looks at current non-removed rows for that day before the new one is added.

## History

Header title **History**. Inner row: `<h2>` **Days**, and a pill toggle `role="group"` `aria-label="History layout"`.

| Button | `aria-pressed` | Result |
| --- | --- | --- |
| Calendar | true when mode is `calendar` | Calendar. This is the default after load. Not stored. |
| List | true when mode is `list` | Last 30 local days that qualify |

The pressed pill is gold with dark text. The other is transparent and muted.

### Which days show a calorie count

`showsCalories(day, today, first)`:

- A future day never shows a count.
- A day whose non-removed total is greater than 0 always shows a count. That includes today.
- `first` is the earliest local date that has a non-removed entry with calories greater than 0. A day strictly after `first` and strictly before today shows a count even when the total is 0. Those are the gap days inside the logged span.
- Today with a total of 0 does not show a count. The gap rule requires `day < today`, so it does not apply to today.
- Days on or before `first` with a zero total stay blank. Days before any log at all stay blank.

The list is those qualifying days among the last 30, including today when it qualifies. It is not “14 days” and it does not show percentage of goal. Each row is a full-width button: colored total, the word calories, and the day label. Click opens `/day/{key}`.

### Calendar

Sunday-first. Weekday letters: **Su Mo Tu We Th Fr Sa**.

The visible month starts as the current month (`YYYY-MM`). It is not in the URL and not in `localStorage`.

- **Previous month** chevron, `aria-label="Previous month"`. No lower bound.
- Center label is the month and year in the runtime locale (`month: "long"`, `year: "numeric"`).
- **Next month** chevron, `aria-label="Next month"`. Disabled (opacity 0.35, not a pointer) when the visible month is the current month or later. The click handler also refuses to move past the current month.

Grid is 7 columns. The first cell is the Sunday on or before the 1st. Up to 42 cells. If the last week is entirely outside the month, that week is removed, so some months are 5 rows.

Each cell:

- Day-of-month number from the date key (leading zero stripped by `Number`).
- Past and today, including days that belong to the neighboring month: a `<button>`. Click opens `/day/{key}` even when the cell is greyed as outside the month.
- Future: a non-interactive `<div>`. No calorie count.
- Today: gold tint `rgba(215, 176, 122, 0.14)`.
- Outside the visible month: opacity 0.4.
- Calorie count in the cell only when `showsCalories` is true. Color is the tone color only when the cell is in the visible month **and** that day has a goal. Otherwise the count is `--muted`. A zero gap day still prints `0`.

Focus rings on calendar buttons and list day buttons use a 2px outline.

## Meals

No page title inside the list besides the header **Meals**. No empty sentence. If nothing is saved, the only control is the create button.

Each non-removed meal is a card. Reorder by pressing the drag handle at the bottom right and moving. The rest of the card does not start a drag. The card stays in place while dragging, at 55% opacity. Order is committed on pointer up. Releasing without leaving the gaps beside that card does nothing.

Drop slots are the gaps before the first card, between cards, and after the last card. The pointer’s half of a card picks the gap above or below that card. The top half of the first card, or above it, is the start. The bottom half of the last card, or below it, is the end.

Each of those gaps is always a `0.75rem` row (`.meal-gap`). The gold line (`.drop-line`, 2px, `--gold`) is centered in that row and is transparent until that gap is the drop slot. Turning the line on does not change the row’s height, so the list does not jump. With no meals, there are no gap rows. The create button is not a drop slot.

- Title, title-cased, `1.25rem`, top left. Margins on the title and meta are cleared.
- Meta, under the title: `{description or "No description"} · {calories} calories`. Description is not title-cased.
- One kebab, top right, key `meal:{id}`. The menu opens downward.
  - **Edit** — no icon. Opens `/meal/{id}`.
  - **Remove** — muted red text, no icon. Sets `removed: true` and enqueues `meal.remove`. Does not delete or change log rows that point at this id.
- Drag handle, bottom right. Six dots in two columns. `aria-label="Drag to reorder"`. `touch-action: none` and `cursor: grab` on that button only. Pressing it closes an open kebab and starts the drag immediately.

A successful drop rewrites `state.meals`: visible meals in the new order, then removed meals in their previous order. It enqueues `meal.reorder` with `count: false`, `entityId` set to the meal that moved, and `body.ids` the full id list including removed meals. Dropping into the gap directly above or below the dragged card does nothing.

Under the cards, a full-width button **Create a new meal**: dotted gold border, transparent fill, gold text, min-height `4.6rem`. Opens `/meals/new`.

Removed meals disappear from this list and from the picker. They remain in `state.meals`.

## New meal

Path `/meals/new`. Form class `composer-card`.

| Control | Name | Rules |
| --- | --- | --- |
| Label **Title**, input `#meal-title` | `title` | Required by the browser. Trimmed, then title-cased. Empty after trim does not save |
| Label **Description**, textarea 3 rows `#meal-description` | `description` | Optional. Not required. Trimmed. Not title-cased. `resize: none` |
| Label **Calories**, number `#meal-calories` | `calories` | `min="0"`, required. Must be an integer ≥ 0. `0` is allowed. Fractions are ignored by the save handler |
| Check button | submit | `aria-label="Save meal"` |

Success unshifts the meal, enqueues `meal.create` (its `occurredAt` is “now”, not a user-chosen time), then `history.replaceState` to `/meals`. Back does not return to the empty form. Failure (invalid calories or blank title) leaves the form in place.

There is no cancel button.

## Edit meal

Path `/meal/{id}`. Header title **Edit meal**.

If no meal has that id: **That meal is no longer here.** The removed flag is not checked here, so a removed meal still loads in the form if you have the URL.

Form fields mirror new-meal, ids `edit-meal-title`, `edit-meal-description`, `edit-meal-calories`. Title and the check button’s accessible name differ: the button is `aria-label="Save changes"`. Values are the stored meal, title passed through title case for the initial value attribute.

Save validates like create, maps the one meal, enqueues `meal.update` with `{ title, description, calories }`, then navigates to `/` with `pushState`. Existing log rows keep the title, description, and calories they copied at log time.

There is no delete button on this form. Delete is the kebab on the meal card.

## Goal

Path `/goal`. One form.

- Label **Calories to stay near**, input `#goal-calories`, `type="number"`, `min="1"`.
- The value shown is the goal in effect **today**, or `2000` if today has no goal yet. It is not a separate draft until submit. Re-rendering after a goal save is unlikely to be seen because save navigates away.
- Check button, `aria-label="Save goal"`.
- Help text, verbatim:

  > The calorie color looks across the last seven days, not just today. Today counts in full, yesterday half as much, and each older day a little less. At or under this goal the number stays green (On track). A modest surplus fades toward yellow (Drifting). About 300 calories over that blend reads Running hot, and about 600 over turns red. A day under one third of this goal stays green, and a day under two thirds stays green or yellow.

Save requires an integer greater than 0. It appends a new forward goal `{ id, calories, setAt }` with `setAt` equal to now and no `day`. It does not change older goal rows. It enqueues `goal.create` with `occurredAt` and body `setAt` both set to that timestamp, then `pushState`s `/`. That goal applies to today and every later day that does not have its own day-scoped goal, including today when a one-day goal for today was saved earlier the same calendar day.

### Which goal a day uses

`goalForDay` looks at goals whose `setAt` parses as a time.

A goal with no `day` is a forward goal. Among forward goals whose `setAt` is **on or before the last millisecond of that local day**, pick the greatest `setAt`. If two share `setAt`, the greater `id` string wins. A goal set on Tuesday afternoon does not apply to Monday, and it does apply to Tuesday.

A goal with `day` set to a real local date key applies only to that date. It is an override. Its `setAt` does not have to fall on that date: opening an old day and saving uses `setAt` of now. Other days never see it. A later forward goal saved on a different calendar day does not clear it.

One exception: if a forward goal’s own local calendar date is this same day and that forward goal’s `setAt` is later than the latest override (or the times are equal and the forward id is greater), the forward goal wins for that day. That is how the Goal page still resets today after a one-day goal was saved for today. Days after that forward goal use it too. A forward goal does not reach backward onto an earlier override.

A day with no forward goal and no override has no goal: no status label, ink-colored total, and the summary button reads `/ no goal set`.

`latestGoal` is the greatest `setAt`, then id, among goals that have no `day`. Day-scoped goals do not become the activity document’s current goal. The live screen uses `goalForDay` for today instead, which matches `latestGoal` unless a goal is stamped in the future or today has a day-scoped override that is still newer than any forward goal set on that same calendar day.

### Fast modal

Opened by the empty-state fast link on Today (day key `todayKey()`) or on a day page (that page’s key). It is rendered next to the edit and day-goal modals so both pages share it. It reuses the edit sheet: `.edit-sheet` dim layer, `.edit-modal` dialog, `role="dialog"`, `aria-modal="true"`, labelled by `#fast-heading`. Clicking the dim layer closes it. `Escape` while focus is inside closes it. Clicking the dialog does not. No history entry. No check button. Closing does not discard a toggle.

- Heading **Did you fast?**
- Toggle off: **This day will be counted as X calories for the purpose of goal tracking since no food was logged.** X is that day’s goal from `goalForDay`, or 2000 when the day has no goal. Not formatted with thousands separators.
- Toggle on: **This day will be counted as 0 calories because you marked it as a fast.**
- A switch labelled **I fasted today**: a `button` with `role="switch"` and `aria-checked`.
- Under it: **Turn on this toggle if you actually did not eat anything today.**

Flipping the switch commits at once: it appends a `Fast` `{ id, day, fasted, setAt }` with a new UUID and `setAt` now, and enqueues `fast.set` with `occurredAt` now and body `{ day, fasted, setAt }`. The modal stays open and the text updates. Turning it off writes `fasted: false`; older rows are never changed or removed. Logging food later does not clear the mark; the food is scored and the link hides, and if all entries are removed the mark applies again.

### Aim modal

Opened only from the **Aim for less than {n} calories today** button on Today. It reuses the edit sheet: `.edit-sheet` dim layer, `.edit-modal` dialog, `role="dialog"`, `aria-modal="true"`, labelled by `#aim-heading`. Clicking the dim layer closes it. `Escape` while focus is inside closes it. Clicking the dialog does not. No history entry. No check button.

- Heading **Why less than {n}?** `{n}` is `yellowCalories` for today, with no thousands separators.
- One line: **You ate over your {goal} calorie goal on earlier days. Yesterday still counts half as much, and each older day a little less, so eating {n} today turns the number yellow before you reach {goal}.** `{goal}` is today’s goal from `goalForDay`, also with no thousands separators.

If that button is not on screen, the modal is not rendered.

### Color

Constants in [src/shared/util.score.ts](src/shared/util.score.ts):

- Green `rgb(111, 191, 132)`
- Yellow `rgb(224, 184, 74)`
- Red `rgb(214, 84, 78)`
- Yellow threshold `300`
- Red threshold `600`

For a viewed day D and that day’s goal G, look at D, D−1, … D−6. Each slot contributes `(assumed calories that day − G) * weight`, where assumed calories (`assumedCalories` in [src/shared/util.score.ts](src/shared/util.score.ts)) depend on the day’s status:

- **Logged**: at least one non-removed entry. The sum of those entries. A fast mark is ignored while food exists.
- **Fasted**: no non-removed entries and the latest fast mark for that date says fasted (greatest `setAt`, then greater `id`). 0.
- **Untracked**: no non-removed entries and not fasted. G, the viewed day’s goal, or `UNTRACKED_FALLBACK` (2000) when the viewed day has no goal.

| Days before D | Weight |
| --- | --- |
| 0 | 1 |
| 1 | 1/2 |
| 2 | 1/3 |
| 3 | 1/4 |
| 4 | 1/5 |
| 5 | 1/6 |
| 6 | 1/7 |

The same G is subtracted for every slot. Older days do not use their own historical goal inside this sum. A day under goal produces a negative term and can pull a later overage back toward green. Removed entries are excluded. An untracked empty day counts as G, so it contributes 0. A day marked fasted with no food counts as 0, so it contributes `−G * weight`. Example: goal 1800, today 2230, the previous six days untracked, gives a weighted sum of 430, which is Running hot. The big calorie numbers (Today, day pages, history, calendar) stay the logged total, so an untracked or fasted day still shows 0. Only the tone color and status label use assumed calories.

After the sum, the viewed day’s logged total — the number on screen, not the assumed calories — can hold the color back. This applies on Today, a day page, history, and the calendar, using that day’s own logged total and goal. If the logged total is less than one third of G, the value used for the label and color is capped at 0, so the day stays green (On track) even when earlier days would have made it yellow or red. If the logged total is below two thirds of G, the value is capped at the yellow threshold, so the color stays green through solid yellow and the label is at most Running hot, never Over the window. Exactly one third of G uses the two-thirds cap. Exactly two thirds of G uses the uncapped sum. An untracked or fasted day logs 0, which is under one third, so that day stays green.

| Weighted sum | Label | Color |
| --- | --- | --- |
| ≤ 0 | On track | Solid green |
| > 0 and < 300 | Drifting | Linear mix from green to yellow |
| Exactly 300 | Running hot | Solid yellow. The label flips at 300, the color reaches yellow at 300 |
| > 300 and < 600 | Running hot | Linear mix from yellow to red |
| ≥ 600 | Over the window | Solid red |

Mixing is per channel, rounded, clamped to 0..1.

The main Today page shows no status line for **On track** or when today has no goal. The header already says **Today**. **Drifting**, **Running hot**, and **Over the window** appear alone, with no kicker and no em dash. A day page always shows the kicker, em dash, and label when that day has a goal, including **On track**.

The big number on Today and on a day page uses this color. History list totals use it whenever that day has a goal. Calendar counts use it only for in-month cells that have a goal.

`yellowCalories` in [src/shared/util.score.ts](src/shared/util.score.ts) is the smallest logged total that would leave solid green on that day, or nothing when that total is not strictly below the goal. Prior days use the same assumed calories and weights as the color, scaled by 420 so the fractions stay exact. Today’s own logged total is the unknown: it leaves green when the raw weighted sum is greater than 0 and the total is no longer under one third of the goal. The one-third hold still applies, so a large earlier surplus cannot push the number below `ceil(goal / 3)`. A day under the goal on an earlier slot, or a fasted earlier day, can pull the line back up to the goal or past it, and then the function returns nothing. Untracked earlier days contribute 0, so the line is the goal plus one and the hint stays hidden. `dayCalorieTarget` is that number when it exists, and the goal otherwise. Today’s remaining line subtracts the logged total from it.

## Competitions

Competitions are shared server state. They are not operations and they are not part of `NutritionState`. The food log stays on the user’s own ops. A competition payload never includes calories, meals, or entries.

Two types, chosen at create and never changed:

- **Last one standing** (`last_one_standing`). The first locked day that is not On track knocks that player out. When one player is left, they win and the competition is completed. If every player still in drops on the same locked day, they share the win. There is no month end.
- **Best of the month** (`best_of_month`). On track is +1. Drifting is 0. Running hot, Over the window, and a miss are −1. Only days from Start through the end of that month count. The highest total wins, even when it is negative. Ties share the win.

The label is the existing seven-day weighted label from [src/shared/util.score.ts](src/shared/util.score.ts), not “calories today versus the goal.” The same weights, `clampTone`, and `toneLabel` are used. The window is bucketed in the player’s timezone ([src/shared/util.competition.ts](src/shared/util.competition.ts)), not with `dateKey()`, because the server process is UTC.

A day with a positive goal and no log and no fast is a miss. A fast with no log is On track, because logged 0 is under one third of the goal and `clampTone` forces it to green. A scored day with no positive goal in effect is a miss. Empty lookback days are still assumed equal to that day’s goal. Days before Start are not scored, but they can still tint a scored day through the seven-day window.

### Who can do what

The creator is the host, is a player, and is already accepted. At least one other email is required. Emails are trimmed and lowercased. The host cannot add their own email. Duplicate emails are rejected. Any address can be invited. An unknown account stays pending until someone signs in with that exact email (comparison ignores case) and accepts. Once accepted, the seat belongs to that account’s user id. A second login with the same email does not see, accept, or decline it. A person can be in more than one competition.

A positive calorie goal for the viewer’s current local day is required to create and to accept. The copy is **Set a goal before you start a competition.** and **Set a goal before you join.** Changing the goal number later is fine. Start does not check the goal again. The next locked day with no goal is a miss.

Only the host adds or removes emails, and only while the phase is waiting. Decline deletes that member row (204, empty body) and is only available to a pending non-host while waiting. After Start the roster is frozen: add, remove, and decline fail with **This competition has already started.** Pending members block Start (**Everyone has to accept before you can start.**). Start is a host action. It sets `startDay` to the host’s calendar date at that instant and, for best of the month, `monthEnd` to the last calendar day of that month. The host timezone captured at create is what those dates use. Each accepted player’s timezone is captured at accept and is not updated later.

Someone who is not a member gets **That competition is not here.** (404), including another signed-in user.

### When a day locks

Each player’s calendar day locks at the next local midnight in that player’s timezone. The fold for a locked day keeps ops whose `receivedAt` is strictly before that instant. An op with no `receivedAt` uses `occurredAt`. An edit that reaches the server after midnight does not change the locked day. A log that never arrives by midnight locks as a miss.

Today stays provisional. It is shown and it does not award points or knock anyone out. The detail line is **Today, not locked ·** plus the label.

Last one standing does not apply a day’s eliminations until that calendar day has locked for every player still in. A player in an earlier timezone cannot win a day that a later timezone has not locked yet. Best of the month adds points for a player as soon as that player’s own day locks. It completes only once `monthEnd` has locked for every accepted player.

### Pages

Header titles: **Competitions**, **New competition**, and on a competition the type name (**Last one standing** or **Best of the month**). No dock.

Signed out, including auth not configured: **Sign in from the menu to see competitions.** While the account is still `checking`: **Checking account…** Offline: **Competitions need a connection.** Those three replace the page. Competitions are not stored on the device.

List, when signed in and online:

- Empty, after a load: **No competitions yet.**
- While the first load has no rows yet: **Loading competitions…**
- Each row is a button. First line is the type. Second line is the phase (**Waiting**, **Active**, or **Completed**), a middot, and **1 person** or **N people**. Order from the server is active, then waiting, then completed.
- A fixed gold plus, `3.25rem`, `z-index: 4` (under the menu at 12 and the edit sheet at 20), `aria-label="New competition"`. The list has bottom padding so the last row can clear it.

Create:

- Two type buttons, `aria-pressed`. **Last one standing** — “The first day that is not On track knocks you out.” **Best of the month** — “On track +1, drifting 0, a hot day or no log −1, through the end of the start month.” Default is last one standing.
- Email field with a datalist of suggestions, and **Add**. A chip list follows. Each chip has **Remove** (`aria-label="Remove {email}"`). At least one other email is required (**Add at least one email.**). Adding yourself says **You are already in this competition.** A duplicate on the form says **That email is already on the list.**
- The check submits, `aria-label="Create competition"`. Success opens that competition.

Detail:

- Phase, and once started the start day, and for best of the month an en dash and the month-end day. Example shape: `Active · Oct 25–Oct 31`.
- When completed, one winner is `{email} won.` or **You won.** More than one is `{emails} share the win.`
- One card per member, host first in insertion order. The email, then a muted line of **Host**, **You**, **Pending**, **Winner**, **In**, or **Out**. Best of the month adds **N points** / **1 point**. A knockout adds **Out {day label}**. A provisional call uses the tone color: On track `rgb(111, 191, 132)`, Drifting `rgb(168, 188, 103)`, Running hot `rgb(224, 184, 74)`, Over the window `rgb(214, 84, 78)`, No log muted.
- A pending viewer gets **Accept** and **Decline**. Decline returns to the list and replaces the history entry.
- The host sees **Start** only when `canStart` is true (host, not started, at least two members, every member accepted).
- While waiting, the host can remove any non-host member and can add another email. The field’s placeholder is **Add an email**. Suggestions are the same datalist.

Server errors render in an `offline-note` under the form or under the member list. A 401 sets the existing **Sign in again to sync.** line and does not add a second competition note. The list and the open competition reload after a successful food sync, and when the page is opened.

### Suggestions

`GET /api/competitions` returns `suggestions`: email addresses this viewer has added as a host, sorted, unique. Removing a member or a decline does not forget the address. They are not a directory of every Nourish user. Only addresses this viewer has added are included.

### HTTP

Timezone is required on every competitions call. The browser sends `Intl.DateTimeFormat().resolvedOptions().timeZone` as `timezone` in the JSON body, or as a query parameter on GET and DELETE. An unknown zone is 400 **Unknown timezone.** A token with no email is 400 **Sign in with an email address.**

| Request | Result |
| --- | --- |
| `GET /api/competitions?timezone=` | 200 `{ suggestions, competitions }` |
| `POST /api/competitions` `{ kind, emails, timezone }` | 201 the new competition |
| `GET /api/competitions/{id}?timezone=` | 200 the competition, or 404 |
| `POST /api/competitions/{id}/emails` `{ email, timezone }` | 200 the competition |
| `DELETE /api/competitions/{id}/emails?email=&timezone=` | 200 the competition |
| `POST /api/competitions/{id}/accept` `{ timezone }` | 200 the competition |
| `POST /api/competitions/{id}/decline` `{ timezone }` | 204 empty |
| `POST /api/competitions/{id}/start` `{ timezone }` | 200 the competition |

`kind` must be `last_one_standing` or `best_of_month` or the error is **Pick a competition type.** `emails` must be an array or the error is **Add at least one email.** A non-host who tries a host action gets **Only the host can do that.** (403). Other host-only failures use the sentences above.

Competition JSON (`CompetitionView`): `id`, `kind`, `phase` (`waiting`, `active`, `completed`), `startDay`, `monthEnd`, `host`, `canStart`, `winners` (emails), `members`. Each member: `email`, `host`, `invite` (`accepted` or `pending`), `you`, `standing` (`in`, `out`, `winner`, or null while waiting), `points` (integer, or null for last one standing), `knockedOutOn`, `today` (`on-track`, `drifting`, `running-hot`, `over`, `miss`, or null).

### Storage

Migration [netlify/database/migrations/20261025180000_competitions.sql](netlify/database/migrations/20261025180000_competitions.sql).

| Table | Role |
| --- | --- |
| `competitions` | `id` UUID primary key, `host_user_id` FK to `nourish_users`, `kind` check, `host_timezone`, `created_at`, nullable `started_at`, nullable `start_day` and `month_end` as text so a UTC session cannot shift the calendar date |
| `competition_members` | Primary key `(competition_id, email)`. `user_id` nullable, `role` `host` or `player`, `status` `accepted` or `pending`, nullable `timezone`. Cascade delete with the competition. Indexes on `email` and `user_id` |
| `competition_suggestions` | Primary key `(host_user_id, email)`. One row per address that host has added. Not deleted when the seat is removed |

Competition writes take `pg_advisory_xact_lock(hashtext('nourish-competitions'))` so two hosts cannot interleave a read-modify-write. Food sync keeps its own per-user lock.

The file store keeps `competitions` and `suggestions` on the same `data/nourish.json` document, on the same exclusive chain as food sync. A transaction saves only if the work resolves.

Linking: when a member’s email matches the viewer, `userId` is filled in if it was empty or different. That write happens on list and on read.

## Account

Auth0 SPA via `@auth0/auth0-spa-js`, built into the bundle. No client secret.

Build-time replacements in [rollup.config.js](rollup.config.js):

| Token | Env | If missing |
| --- | --- | --- |
| `__NOURISH_AUTH0_DOMAIN__` | `AUTH0_DOMAIN` | Empty. Build prints that this build cannot sign in. Domain is stripped of scheme and trailing slashes at runtime |
| `__NOURISH_AUTH0_CLIENT_ID__` | `AUTH0_CLIENT_ID` | Empty |
| `__NOURISH_AUTH0_AUDIENCE__` | `AUTH0_AUDIENCE` | `https://identity.megazear7.com` |
| `__NOURISH_IDENTITY_URL__` | `NOURISH_IDENTITY_URL` | `https://identity.megazear7.com/data` |

`authConfigured` is true only when both domain and client id are non-empty. Otherwise `initAuth` resolves immediately to status `unconfigured`, and Log in / Sign up only set the sync note.

When configured, the client is created with:

- `cacheLocation: "localstorage"`
- `useRefreshTokens: true`
- `useRefreshTokensFallback: true`
- `authorizationParams.audience` from the table
- `redirect_uri: window.location.origin`

On load, if the query has both `code` and `state`, `handleRedirectCallback` runs, then `replaceState` leaves only `pathname` + `hash`. That path is the only time `recordLogin` runs. A silent `getTokenSilently` refresh does not increment the login count. If the refresh token is missing, fallback uses the Auth0 session cookie before giving up. `accessToken` returns null only for `login_required`, `missing_refresh_token`, and `invalid_grant`. Any other failure is thrown, and flush records `Sync failed.`

If Auth0 says the user is authenticated and `getUser()` has a `sub`, status is `signed-in` with `sub`, `email`, `picture`, and `name` (missing strings become empty). `name` here is the Auth0 display name from the rule in the side menu, not a local override and not the raw Auth0 `name` when that raw value is only the email. The menu and the header initials prefer `nourish-display-name` for this `sub` when it has an entry. Otherwise signed out.

**Log in** calls `loginWithRedirect` with the same audience and redirect. **Sign up** adds `screen_hint: "signup"`. The **Sign in again to sync.** status button and the menu’s **Re-authenticate** button both call **Log in**.

**Sign out** calls `logout` with `returnTo` set to this origin. Auth0 leaves the page. The food log remains on the device. **Re-authenticate** does not call this.

Access tokens are sent as `Authorization: Bearer`. The raw ID token is sent only as `X-ID-Token` on the identity activity PUT. Access tokens do not include email unless an Auth0 Action adds it. The server stores a null email in that case.

Server JWT check ([src/server/auth.ts](src/server/auth.ts)):

- Bearer token required.
- Issuers are `https://{host}/` for every comma-separated host in `AUTH0_DOMAIN` and optional `AUTH0_ISSUER_DOMAINS`.
- JWKS is fetched from the first of those hosts.
- Audience defaults to `https://identity.megazear7.com`.
- `sub` is required and must be at most 128 characters.
- Any verify failure is 401 `{ "error": "unauthorized" }`.

Changing `AUTH0_DOMAIN` or `AUTH0_CLIENT_ID` requires a new client build. A deploy preview built before those variables existed must be rebuilt. The Netlify secrets scanner is told to ignore the auth and test variable names so the public SPA values can sit in the build environment.

## Offline, install, storage

### Service worker

[public/sw.js](public/sw.js) is copied to `dist/client/sw.js` with `__NOURISH_BUILD__` replaced by the first 12 hex chars of the SHA-256 of `bundle.js`. Cache name is `nourish-{those 12}`.

Precache, each fetched with `cache: "reload"`:

- `/index.html` (also stored as `/`)
- `/bundle.js`
- `/manifest.json`
- `/favicon.ico`, `/favicon-32.png`, `/apple-touch-icon.png`
- `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`
- `/fonts/inter-latin.woff2`

Install calls `skipWaiting`. Activate deletes every cache whose name is not the current build and calls `clients.claim`. A precache response that is HTML for a non-HTML URL throws, so a redirect to the SPA shell cannot be stored as `bundle.js`.

Fetch handling:

- Non-GET ignored.
- Other origins ignored.
- `/sw.js` ignored.
- Any path under `/api/` ignored, so logs are not served from the cache.
- `navigate` mode: cached `/index.html`, else cached `/`, else network `/index.html`.
- Anything else same-origin: cache match, else network. Cache is not updated on that read.

The page registers `/sw.js` on startup, requests `navigator.storage.persist()` and ignores failure, and calls `registration.update()`. When the tab becomes visible it flushes sync and updates the registration again. If a controller already existed, the next `controllerchange` reloads once. `sessionStorage` key `nourish-reloading` stops a loop. If `sessionStorage` throws, the reload is skipped but registration still runs.

### Web app manifest

[manifest.json](manifest.json):

- Name and short name **Nourish**. Description “A simple, elegant nutrition tracker”.
- `id`, `start_url`, and `scope` are `/`.
- `display: standalone`. `orientation: portrait-primary`.
- `background_color` `#070911`. `theme_color` `#0c0d18`. The HTML `theme-color` meta matches.
- Icons: 192 any, 512 any, 512 maskable, 32 any.
- Shortcuts: **Today** `/`, **Day by day** `/history`, **Meals** `/meals`, **Goal** `/goal`.

`index.html` also sets description, Open Graph, Twitter card (`summary`), Apple mobile web app capable, `black-translucent` status bar, Apple title **Nourish**, favicon ico, 32px PNG, and apple touch icon. Inter is preloaded and declared with `font-display: swap` for a latin unicode range.

Netlify headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. `sw.js`, `index.html`, and `/` are `Cache-Control: no-cache`. `manifest.json` is served as `application/manifest+json` and must revalidate. `bundle.js` is `public, max-age=0, must-revalidate`.

### localStorage keys

| Key | Contents |
| --- | --- |
| `nourish-state` | `{ entries, meals, goals, fasts }`. A document without `fasts` loads with `fasts: []`. This is the open document |
| `nourish-queue` | `{ deviceId, syncedUserId, ops }` |
| `nourish-account:{userId}` | Stash `{ state, queue }` for a previous signed-in user on this device |
| `nourish-activity` | Activity counters. One document for the browser profile, not keyed by user |
| `nourish-display-name` | JSON object of Auth0 `sub` to a trimmed display name. Missing, corrupt, or empty reads as no overrides. Not part of the food document, not queued, and not stashed on an account switch |

Corrupt JSON or a document that fails the Zod shape yields an empty state or an empty queue. A queue without a string `deviceId` is replaced with a new queue and a new `deviceId`.

Legacy migration: if the parsed document has no `goals` array but has `goal: { calories }` (positive integer), one goal row is created with a new UUID and `setAt` of now, and the state is saved back without the old `goal` field. If `goal` is still present beside `goals`, the next load saves again so the old field is dropped, and does not add a second row.

`sessionStorage` key `nourish-reloading` is only the service-worker reload guard.

Sign-out does not remove these keys.

### Switching accounts

`deviceId` is created once per queue and is meant to stay stable for the browser profile.

On a signed-in session:

- If `syncedUserId` is already this `sub`, just mark it again.
- If `syncedUserId` is someone else: stash that user’s current `nourish-state` and queue under `nourish-account:{oldSub}`. Then if a stash exists for the new `sub`, restore its state and its queue but **keep the current `deviceId`**. If no stash exists, reset the open document to empty entries, meals, and goals, and reset the queue’s ops, keeping `deviceId` and clearing `syncedUserId`. Then set `syncedUserId` to the new `sub`. The previous user’s queued ops are not uploaded to the new account.
- If `syncedUserId` is null (typical first login on a log that was started signed out): `backfillCreates` adds queued ops for rows that do not already have a `*.create` in the queue, all with `count: false`, then `syncedUserId` is set. Rows already queued from signed-out taps are left alone, including their original `count`.

Backfill, for anything not already represented by a `*.create` op still in the queue:

- Each entry: `entry.create` at the entry’s own timestamp, `count: false`. If the entry is already removed, a following `entry.remove` at that timestamp plus 1 millisecond, also `count: false`.
- Each meal: `meal.create` at now, `count: false`, and `meal.remove` one millisecond later if removed.
- Each goal: `goal.create` at the goal’s `setAt`, `count: false`. The body is `{ calories, setAt }` plus `day` when the stored goal has one.
- Each fast not already queued as a `fast.set`: `fast.set` at the fast’s `setAt`, `count: false`, body `{ day, fasted, setAt }`.

`count: false` means the activity counters do not increase. The food log still syncs.

Activity totals in `nourish-activity` are **not** stashed per user. They stay in one local key and are PUT to whatever account is signed in, at `activity/{deviceId}`.

## Sync

Every create, edit, and remove goes through `commit`:

1. Optimistic local state.
2. `saveState`.
3. If there are drafts, `enqueue` then `recordOps`, then `flush`.

Flush runs only when status is `signed-in`. Flushes are chained so one finishes before the next starts. Triggers: end of `commit`, app start after auth, `online`, and the tab becoming visible.

Queue item shape: `{ opId, type, entityId, occurredAt, body, count }`. `opId` is a new UUID per enqueue. `count` defaults true. `occurredAt` defaults to now. `body` defaults to `{}`.

If the queue has ops, `POST /api/ops` with `{ deviceId, ops }` where `count` is stripped before send. Headers: bearer token and `application/json`.

- 401 throws the sign-in message.
- Non-OK throws `Sync failed (status)`.
- Results with status `applied` or `duplicate` are removed from the queue by `opId`.
- `rejected` results stay in the queue and produce the “could not sync” note. They will be sent again next flush.
- If the payload includes `state`, or top-level `entries` + `meals` + `goals`, that server state is saved, then any ops still queued are folded on top and that merge is what the UI shows. The server remains the base. Pending local ops are reapplied in `occurredAt` then `opId` order.

If the queue is empty, `GET /api/state` replaces local state. A payload that is not a state object is ignored.

After the food call, the client PUTs activity. That failure does not roll back the food log.

The server folds by `occurredAt`, then `opId`. A slow device that uploads an older edit after a newer one does not win. Two creates of the same `entityId` ignore the second. A patch or remove for an unknown id is a no-op inside the fold, but the op is still stored if it was accepted.

## Operations

Types, in [src/shared/type.op.ts](src/shared/type.op.ts):

| Type | Body | Fold |
| --- | --- | --- |
| `entry.create` | `calories` positive integer, `eatenAt` non-empty string, optional `mealId` UUID, optional `mealTitle`, optional `mealDescription` | Insert if that id is new. `eatenAt` becomes `timestamp` |
| `entry.patch` | At least one of `calories` (positive integer), `eatenAt`, `mealTitle`, `mealDescription` | If the entry exists, overlay the provided fields. `""` is a real title, not a delete, because only `null`/`undefined` fall back |
| `entry.remove` | Empty object, unknown keys rejected | Set `removed: true` if the entry exists |
| `meal.create` | `title` trimmed, at least 1 character; `description` string; `calories` integer ≥ 0 | Insert if new |
| `meal.update` | Same as create | Overlay if the meal exists |
| `meal.remove` | Empty object | Set `removed: true` if the meal exists |
| `meal.reorder` | `ids`: at least one UUID. Duplicates are allowed by the schema; the fold keeps the first | Rebuild meal order: listed ids that exist, in that order, then any meal not listed, in its previous order. After this, a later `meal.create` is inserted at the front. Before any reorder, creates still append in time order |
| `goal.create` | `calories` positive integer, `setAt` non-empty, optional `day`. `day` must be a real local date key (`YYYY-MM-DD` that survives `dateKey(parseDateKey(day))`). An invalid `day` rejects the op. Omitting `day` stays valid | Insert if that id is new. `day` is copied onto the goal when present. Goals are never updated or removed |
| `fast.set` | `day` real local date key (same rule as a day-scoped goal), `fasted` boolean, `setAt` non-empty | Insert if that id is new. Each toggle is a new row with a new UUID; older rows are never updated or deleted. Per day the greatest `setAt` wins, then the greater id |

`opId` and `entityId` must be UUIDs. `occurredAt` must be a non-empty string.

Acceptance ([src/shared/apply.ts](src/shared/apply.ts)), per op, in request order, before the fold:

- Zod failure: `rejected` with the first issue message. A bad op does not block the rest of the batch.
- `opId` already stored for this user: `duplicate`. Not applied again.
- `opId` already stored for a different user: `rejected`, reason `conflict`.
- `entityId` already owned by a different user: `rejected`, reason `conflict`.
- Otherwise `applied`, and this user owns that entity from then on.

`POST /api/ops` allows at most 1000 ops. Missing `ops` array is 400 `{ "error": "ops array required" }`. Too many is 400 `{ "error": "too many ops" }`. Other methods or paths are 404 `{ "error": "not_found" }`. `OPTIONS` is 204 before auth. Uncaught errors are 500 `{ "error": "<message>" }`.

`deviceId` is stored on the operation only when it is a UUID. The file store ignores it. Postgres uses a transaction-scoped advisory lock on `hashtext(userId)` so one user’s syncs do not interleave.

Response JSON: `{ results: [{ opId, status, reason? }], state }`. `state` is the full fold of that user’s ops, including removed rows.

## Data model

[src/shared/type.nutrition.ts](src/shared/type.nutrition.ts).

**CalorieEntry:** `id`, `calories` (positive integer), `timestamp` (ISO string), optional `mealId`, `mealTitle`, `mealDescription`, optional `removed`.

**Meal:** `id`, `title` (min 1), `description`, `calories` (integer ≥ 0), optional `removed`.

**Goal:** `id` (min 1), `calories` (positive integer), `setAt` (min 1), optional `day` (a real local date key). No `day` means the goal runs forward from `setAt`. A `day` means that one date only.

**Fast:** `id` (min 1), `day` (a real local date key), `fasted` (boolean), `setAt` (min 1). Per day, the greatest `setAt` wins; on a tie the greater `id`; no mark means not fasted (`fastForDay`, `isFasted` in [src/shared/fold.ts](src/shared/fold.ts)).

**NutritionState:** `entries`, `meals`, `goals`, `fasts`. Competitions are not in this document.

**DaySummary** (`date`, `totalCalories`, optional `goal`) is defined and not used by the UI.

Totals use local dates via `dateKey`: year, month, and day from the `Date` in the runtime timezone, zero-padded. The server does not reinterpret “today”. It stores the timestamps the client sent.

## Identity activity

[src/client/util.activity.ts](src/client/util.activity.ts) and [src/client/identity-client.ts](src/client/identity-client.ts).

Local document:

| Field | Meaning |
| --- | --- |
| `loginCount` | Incremented only on the interactive redirect callback |
| `lastLoginAt` | ISO time of that callback |
| `mealsCreated` | Counted `meal.create` ops |
| `entriesCreated` | Counted `entry.create` ops |
| `goalUpdates` | Counted `goal.create` ops. The name says updates; the event is a new goal row |
| `currentGoal` | Calories of `latestGoal`, or null |
| `updatedAt` | Set when a counted op changes a counter or `currentGoal` changes |

Patches, meal updates, removes, and reorders do not increment counters. Ops with `count: false` do not increment counters. `meal.reorder` is enqueued with `count: false`. `currentGoal` is still compared on every `recordOps` call.

PUT URL: `{NOURISH_IDENTITY_URL}?app=nourish&visibility=private&path=activity/{deviceId}`

Body: `{ "data": <document> }`

Headers: `Authorization: Bearer`, `Content-Type: application/json`, and `X-ID-Token` when an ID token exists.

The identity app is expected to show entries, meals, logins, the current goal, and last login for Nourish. `NOURISH_ORIGIN` on that service is what makes an “open Nourish” link. Deleting Nourish there deletes those activity blobs only.

## Server storage

### Postgres

Migration [netlify/database/migrations/20261009120000_nourish_log.sql](netlify/database/migrations/20261009120000_nourish_log.sql). The function uses `@netlify/database` / Neon serverless (`poolQueryViaFetch`).

| Table | Role |
| --- | --- |
| `nourish_users` | `user_id` primary key, nullable `email`, `created_at`, `updated_at`. Email is filled in with `COALESCE` so a later token without email does not wipe a known email |
| `operations` | Append-only. `op_id` UUID primary key. `user_id` FK cascade. `device_id` UUID nullable. `entity_id`, `op_type` check constraint for the nine types, `occurred_at`, `received_at` default now, `body` JSONB. Index `(user_id, occurred_at, op_id)`. Insert is `ON CONFLICT (op_id) DO NOTHING`. `meal.reorder` is added by [netlify/database/migrations/20261011150000_meal_reorder.sql](netlify/database/migrations/20261011150000_meal_reorder.sql), which replaces `operations_op_type_check`; `fast.set` is added the same way by [netlify/database/migrations/20261014120000_fasts.sql](netlify/database/migrations/20261014120000_fasts.sql) |
| `calorie_entries` | Folded read model, rewritten on each sync. Positive calories, `eaten_at`, optional meal fields, `removed` default false |
| `meals` | Same. Title required, description default `''`, calories ≥ 0, `removed` |
| `goals` | Same. Positive calories, `set_at`. Nullable `day` text, added by [netlify/database/migrations/20261013130000_goal_day.sql](netlify/database/migrations/20261013130000_goal_day.sql). Null is a forward goal. A date key is one day. Index `(user_id, set_at)` |
| `fasts` | Same, rewritten on each sync. `id` UUID primary key, `user_id` FK cascade, `day` text, `fasted` boolean, `set_at`, `updated_at`. Created by [netlify/database/migrations/20261014120000_fasts.sql](netlify/database/migrations/20261014120000_fasts.sql). Fast ids are part of the entity-owner lookup before `acceptOps` |

On sync the three read-model tables for that user are deleted and reinserted from the fold, including removed rows. `GET /api/state` does **not** read those tables. It loads `operations` and folds them. Inserting the user row on read uses `ON CONFLICT DO NOTHING` and does not refresh email.

Deleting a `nourish_users` row cascades to ops and read models. The identity console does not do that.

Connection string, first hit wins: `NETLIFY_DB_URL`, `NETLIFY_DATABASE_URL`, `DATABASE_URL`, then `getConnectionString()` from `@netlify/database`. If none is available, `liveStore()` throws and the function returns 500.

### File store

Local server only. [src/server/file-store.ts](src/server/file-store.ts) writes `data/nourish.json` (gitignored). Shape is `{ users, ops, owners, competitions, suggestions }`. Writes are serialized on one promise chain. `read` can insert the user when an email is present. `deviceId` is ignored. Same `acceptOps` rules as Postgres. Competition transactions share that chain and save only when the work resolves.

## HTTP surface

[src/server/handle.ts](src/server/handle.ts). Paths match `/api/state`, `/api/ops`, and `/api/competitions` (plus `/{uuid}`, `/emails`, `/accept`, `/decline`, and `/start`) with or without a trailing slash, including the Netlify form `/.netlify/functions/api/…`.

| Request | Auth | Result |
| --- | --- | --- |
| `OPTIONS` any | no | 204 empty |
| `GET /api/state` | bearer | 200 nutrition state. Creates the user row if needed. Empty log is `{ entries: [], meals: [], goals: [], fasts: [] }` |
| `POST /api/ops` | bearer | 200 `{ results, state }` |
| `/api/competitions…` | bearer | See [Competitions](#competitions). `CompetitionError` keeps its status. A JSON body that is not an object is 400 `invalid body`. Invalid JSON is 500 |
| anything else under the function | bearer | 404 JSON |
| missing or bad token | | 401 JSON, not the HTML shell |

Anonymous `GET /api/state` must stay JSON. A deploy that returns `index.html` for `/api/*` is wrong. Netlify `force = true` on the `/api/*` redirect is what keeps the SPA fallback off those paths.

Local static server [scripts/serve.mjs](scripts/serve.mjs): binds `127.0.0.1` and `PORT` or 3000. `/api/*` is handled in process with `FileStore` and `liveAuth`. Other paths are files under `dist/client`. A path that escapes the client root is 400 `Bad path`. A missing file with an extension is 404 `Not found`. A missing extensionless path falls through to `index.html` with `cache-control: no-cache`.

## Build, scripts, and hosting

[package.json](package.json) name `nourish`, version `1.0.0`, ISC, author Alex Lockhart. Node 22 (`.nvmrc` and Netlify `NODE_VERSION`). Module type is ESM.

| Script | What it does |
| --- | --- |
| `npm start` | `build` then `serve` |
| `npm run serve` | `node scripts/serve.mjs` |
| `npm run build` | `tsc`, then rollup, then `scripts/build-static.mjs` |
| `npm run watch` | `tsc --watch` and `rollup -c --watch` together. Does not run the static copy or the server |
| `npm test` | `tsc`, then `node --test` on `dist/tsc/shared/*.test.js`, `dist/tsc/server/*.test.js`, and `dist/tsc/client/*.test.js` |
| `npm run test:auth` | Resource-owner password grant against Auth0, then `GET /api/state`. Prints entry, meal, and goal counts |
| `npm run lint` | Prettier check on `src`, then ESLint |
| `npm run fix` | Prettier write, then ESLint `--fix` |

[scripts/build-static.mjs](scripts/build-static.mjs) copies `index.html`, `manifest.json`, favicons, `public/icons`, and `public/fonts` into `dist/client`, hashes `bundle.js`, and writes `sw.js`.

[scripts/load-env.mjs](scripts/load-env.mjs) reads `.env` if it exists. It does not override variables already set in the environment. Quotes around values are stripped. Blank lines and `#` comments are skipped.

[scripts/auth-session.mjs](scripts/auth-session.mjs) needs `TEST_USERNAME`, `TEST_PASSWORD`, `AUTH0_DOMAIN`, and `AUTH0_CLIENT_ID`. Realm defaults to `Username-Password-Authentication`. Audience defaults like the app. Base URL defaults to `http://127.0.0.1:3000` or `NOURISH_BASE_URL`. Those two test secrets must never be written into the browser bundle. If Auth0 returns `unauthorized_client` or `access_denied`, the script says to enable the Password grant and the Username-Password-Authentication connection.

TypeScript is strict: no implicit any, no unused locals, no implicit returns, decorators on, target ES2021, `outDir` `dist/tsc`. ESLint bans explicit `any`. Unused arguments may start with `_`.

Netlify [netlify.toml](netlify.toml): build command `npm run build`, publish `dist/client`, functions bundler esbuild. Redirect `/api/*` to `/.netlify/functions/api/:splat` status 200 force. Redirect `/*` to `/index.html` status 200. The function exports paths `/api/ops`, `/api/state`, `/api/competitions`, `/api/competitions/*`, and `/api/competitions/*/*` (a Netlify `*` does not cross a slash, so accept, decline, start, and emails need the second star), and methods GET, POST, DELETE, OPTIONS.

`.env.example` lists every variable. `.env` is gitignored, along with `node_modules/`, `dist/`, `data/`, and logs.

Dependencies that ship: `lit`, `@lit/context` (declared; the live app does not call the context API), `zod` 4, `@auth0/auth0-spa-js`, `@neondatabase/serverless`, `@netlify/database`, `@netlify/functions`, `jose`.

## Tests that lock behavior

Shared fold tests: later `occurredAt` wins even if the older patch is applied second; a patch logged “before” its create still applies once both are sorted; collapsing a quick-add group keeps one row and tombstones the other; a title patch does not create a meal; a later `fast.set` for the same day wins and `fasted: false` clears it; a document without `fasts` loads; a goal set on Oct 1 is what Oct 2 uses, and a goal set on Oct 8 is what Oct 9 uses; a day before every goal has no goal; a day-scoped goal changes only that day and survives a later forward goal on another calendar day; a later forward goal whose `setAt` falls on the override’s calendar day replaces that override; a one-day goal with no forward goal leaves neighboring days empty; legacy `goal` migrates once.

Accept tests: a fractional calorie is rejected and a sibling op in the same batch still applies; repeating an `opId` is `duplicate` and does not double the calories; another user’s `opId` or `entityId` is `conflict`; a `goal.create` with `day` `2026-02-31` is rejected, and `2026-10-05` is stored on the goal.

API tests against the file store: anonymous GET and POST are 401; an unknown bearer is 401; ops survive a new `FileStore` on the same file; a later patch beats an earlier one; a second user’s patch of the first user’s entry is `conflict`; missing `ops` is 400; `public/sw.js` contains the `/api/` bypass.

Queue tests: backfill of an already-removed entry orders create then remove, both `count: false`, and folds to `removed: true`; backfill of a day-scoped goal keeps `day` on the `goal.create` body and `count: false`; backfill of a local fast enqueues one `fast.set` with `count: false`; restoring account A after account B was queued does not keep B’s ops; `resetOpenDocument` keeps `deviceId` and clears ops and `syncedUserId`. Display name ([src/client/util.display-name.test.ts](src/client/util.display-name.test.ts)): Auth0 `name` is used when it is not the email; a name that is only the email is ignored; `given_name` and `family_name` are joined when `name` is the email; a real nickname is used; the email’s local part is not. Local display name ([src/client/util.profile.test.ts](src/client/util.profile.test.ts)): nothing is stored until a name is saved; a saved name belongs to that `sub` only; a blank value or a value equal to the Auth0 display name removes the key when it was the last entry; a corrupt document is ignored.

Score tests ([src/shared/util.score.test.ts](src/shared/util.score.test.ts)): assumed calories for logged, fasted, untracked, and missing-goal days; goal 1800 with today at 2230 and six untracked days is 430, Running hot; a fasted yesterday contributes −900; a logged day uses its real total; a logged day under one third of the goal stays at or under 0; a logged day under two thirds is capped at the yellow threshold. `yellowCalories` is hidden when earlier days sit on the goal, when they were under, when yesterday was fasted, and when yesterday was one calorie over (yellow starts at the goal). Yesterday at 2000 against a goal of 1800 makes it 1701. Yesterday at 10000 keeps the one-third floor, so it is 600. `dayCalorieTarget` is that lower line when it exists, and the goal when it does not.

Competition score tests ([src/shared/util.competition.test.ts](src/shared/util.competition.test.ts)): an October day in `America/New_York` ends at 04:00 UTC; spring-forward and fall-back midnights stay on that calendar date. 1800/2000 is On track, 2100 is Drifting, 2400 is Running hot, 2800 is Over the window. No log is a miss. A fast with no log is On track. No goal is a miss. An entry patched after midnight is ignored by the locked fold and present in the live fold. Last one standing names the last player in, shares a win when the last players miss together, does not knock anyone out while the New York day is still open, and does not finish while a Honolulu player has not locked a day Tokyo already has. Best of the month scores from the start day through month end, leaves the open day provisional, and does not score a day before start.

Competition API tests ([src/server/competition.test.ts](src/server/competition.test.ts)), file store, one shared file, not concurrent: anonymous list is 401; create without a goal, with no emails, or with the host’s own email is 400; a created last-one-standing competition is 201, waiting, and its JSON has neither `calories` nor `entries`; a stranger gets 404; the guest sees the invite; accept without a goal is 400; after a goal, accept is 200; the guest cannot start (403); the host can start, every member then has a standing, and the JSON still has no calories; adding an email after start is 400; the host’s suggestions are `guest@example.com`. A second test creates best of the month, the guest declines (204), the host no longer sees that member, and the suggestion remains.

There is no browser test and no screenshot test in the repo.

## Source map

Every file, and whether the running app uses it.

| Path | Used by the live app? | Role |
| --- | --- | --- |
| [src/client/app.ts](src/client/app.ts) | Yes. Bundle entry | All pages, dock, menus, edit sheet, routing, session |
| [src/client/styles.global.ts](src/client/styles.global.ts) | Yes | All shadow CSS. Includes unused `.hamburger`, `.save-button`, `.text-button`, `.meal-description`, `.calorie-unit`, `.goal-note` rules |
| [src/client/util.auth.ts](src/client/util.auth.ts) | Yes | Auth0 client |
| [src/client/util.profile.ts](src/client/util.profile.ts) | Yes | Local display-name override in `nourish-display-name` |
| [src/client/util.sync.ts](src/client/util.sync.ts) | Yes | Flush and backfill |
| [src/client/util.queue.ts](src/client/util.queue.ts) | Yes | Queue and account stash |
| [src/client/util.storage.ts](src/client/util.storage.ts) | Yes | `nourish-state` load/save and legacy goal migration |
| [src/client/util.activity.ts](src/client/util.activity.ts) | Yes | Local activity counters |
| [src/client/identity-client.ts](src/client/identity-client.ts) | Yes | PUT helper. Only `put` is implemented |
| [src/client/style.ts](src/client/style.ts) | No | Shared CSS for the unused views |
| [src/client/util.store.ts](src/client/util.store.ts) | No | In-memory store for the unused views. Hard-deletes entries and meals. No queue, no tombstones, no sync. `setGoal` does append a goal row |
| [src/client/util.events.ts](src/client/util.events.ts) | No | Zod shapes for `nourish-toast` and `nourish-navigate` custom events. Nothing dispatches them |
| [src/client/view.home.ts](src/client/view.home.ts) | No | `<nourish-home>`: “Today” card, kcal total, percent, gradient bar, free-typed calorie field, **Log**, per-row **Remove**. Not imported |
| [src/client/view.history.ts](src/client/view.history.ts) | No | `<nourish-history>`: 14 local days, percent of the latest goal, no navigation. Not imported |
| [src/client/view.meals.ts](src/client/view.meals.ts) | No | `<nourish-meals>`: inline title/notes/calories form, **Save meal**, **Log today**, **Delete**. Not imported |
| [src/client/view.goal.ts](src/client/view.goal.ts) | No | `<nourish-goal>`: “Daily goal” card, field defaulting to latest goal or 2000, **Save goal**. Not imported |
| [src/shared/type.nutrition.ts](src/shared/type.nutrition.ts) | Yes | State Zod schemas and migration |
| [src/shared/type.op.ts](src/shared/type.op.ts) | Yes | Op schema |
| [src/shared/type.routes.ts](src/shared/type.routes.ts) | No | `RouteName` enum `home`, `history`, `meals`, `goal`, `not_found`. The app uses its own page union instead, including `day`, `meal`, and `new-meal` |
| [src/shared/type.loading.ts](src/shared/type.loading.ts) | No | `LoadingStatus` enum `idle`, `loading`, `success`, `error` |
| [src/shared/fold.ts](src/shared/fold.ts) | Yes | Fold, `goalForDay`, `latestGoal`, `endOfLocalDay` |
| [src/shared/apply.ts](src/shared/apply.ts) | Yes, on the server | Accept, reject, duplicate |
| [src/shared/util.score.ts](src/shared/util.score.ts) | Yes | Totals, weights, tone |
| [src/shared/util.dates.ts](src/shared/util.dates.ts) | Yes | Date keys, labels, clock math, backfill stamp |
| [src/shared/util.zone.ts](src/shared/util.zone.ts) | Yes | IANA calendar dates, zoned midnight, month end. Competitions only |
| [src/shared/util.competition.ts](src/shared/util.competition.ts) | Yes, scoring | Timezone-aware day call and competition board |
| [src/shared/type.competition.ts](src/shared/type.competition.ts) | Yes | Competition Zod views and stored record types |
| [src/server/competitions.ts](src/server/competitions.ts) | Yes, API | Create, invite, accept, decline, start, list |
| [src/server/competition-db.ts](src/server/competition-db.ts) | Yes, API | Store port for competitions |
| [src/shared/util.route-params.ts](src/shared/util.route-params.ts) | No | `:param` pattern matcher. The app uses a meal regex and `startsWith` instead |
| [src/shared/util.wait.ts](src/shared/util.wait.ts) | No | `wait(ms)` promise. Unused |
| [src/server/handle.ts](src/server/handle.ts) | Yes, API | HTTP adapter |
| [src/server/auth.ts](src/server/auth.ts) | Yes, API | JWT verify |
| [src/server/store.ts](src/server/store.ts) | Yes | `NourishStore` interface and file-store apply helper |
| [src/server/postgres-store.ts](src/server/postgres-store.ts) | Yes, Netlify | Neon store |
| [src/server/file-store.ts](src/server/file-store.ts) | Yes, local server | JSON store |
| [netlify/functions/api.ts](netlify/functions/api.ts) | Yes, Netlify | Wires `handleApi(liveStore(), liveAuth())` |
| [public/sw.js](public/sw.js) | Yes | Precache worker template |
| [index.html](index.html) | Yes | Shell |
| [manifest.json](manifest.json) | Yes | PWA manifest |

The unused view components can still be typechecked and are part of the repo. They are not registered in the page the user loads, because nothing imports them into the bundle.

## Walkthroughs

### First visit, no account

Open `/`. Auth becomes `unconfigured`, `signed-out`, or briefly `checking`. Today shows `0` in the ink color, the word calories, and **Did you fast today?** There is no empty sentence.

Taps still call `enqueue`. The queue is not “local only until login.” `flush` returns immediately unless the status is `signed-in`, so the ops sit in `nourish-queue` and the rows sit in `nourish-state`. Refresh keeps both. Airplane mode shows the offline line; another add still sticks.

Three +100 taps inside a minute from the first tap are one bubble of 300. A +500 a minute after that first tap is a second bubble.

On the first login, `syncedUserId` is null, so `backfillCreates` runs. It skips any entity that already has a `*.create` op in the queue, which covers these taps, then marks the user and flushes. Activity counters already moved at tap time because `count` defaulted to true. Backfill does not add a second increment for those rows. Rows that were never queued (for example a document restored from an older shape) are backfilled with `count: false`.

### Signed in, two browsers

Browser A logs food. Flush POSTs ops. Browser B, same user, empty queue, GETs `/api/state` on load, on focus, and when it comes online. Both end on the fold. If they edit the same entry, the greater `occurredAt` wins. The same `opId` posted twice is `duplicate`.

### Offline edit

Signed in, go offline, add calories. The banner shows. The row is on screen and in `nourish-state`. The op is in `nourish-queue`. Come online. The `online` handler flushes. Applied ops leave the queue. The server state replaces local state, then any still-pending ops are painted back on.

### Grouped edit

Five quick adds become one bubble. Edit, set 180, optional title `coffee`. Save. The latest entry remains with 180 calories and title `Coffee`. The other four are `removed: true`. No meal is created. The bubble key changes because it is now one id.

### Goal history

Save 2000 on Monday. Save 1800 on Friday. Monday through Thursday use 2000. Friday and after use 1800, until another goal is saved. The color window on Friday still uses Friday’s 1800 for every slot, not Monday’s 2000: an untracked Monday is assumed to be 1800, so it contributes 0 to the weighted sum. A Monday that was actually logged still uses Monday’s logged total minus 1800. Saving 1600 from Monday’s day page changes Monday only. Thursday stays 2000, and a later forward goal does not put Monday back.

### Install

Browser install uses the manifest. iOS can add to home screen via the Apple meta tags and touch icon. Next launch is standalone, portrait. The worker serves the shell if the network is down. API calls still need the network; until then the on-device log is the UI.
