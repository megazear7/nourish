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
- Set a daily calorie goal. Goals are a history of rows, not one mutable number. A past day keeps the goal that was in effect that day.
- See one color for the day, from a seven-day weighted sum of how far each day sat from the goal.
- Use the app with no account. The log stays in `localStorage`.
- Sign in and sync that log across browsers. Offline edits queue and upload later.
- Install it as a standalone portrait PWA. After the first visit, the shell, fonts, and icons open with no network. The food API is never cached by the service worker.

Production is a static site on Netlify (`dist/client`) plus two JSON endpoints, `GET /api/state` and `POST /api/ops`, backed by Netlify Database / Neon. Local `npm start` uses the same API against a JSON file in `data/`.

## What it does not do

There is no barcode scan, photo estimate, food search, USDA lookup, protein, fat, carb, fiber, water, weight, or fasting clock. There is no household, no shared log, no export button, no import, no undo toast, and no confirm dialog before remove. There is no settings screen. Sign-out does not delete the device log. Deleting the Nourish activity document in the Megazear identity console does not delete the food log. The app does not edit a goal in place and does not rewrite log rows when a saved meal later changes.

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

`/meal` with no id does not match the meal pattern, so it renders Today while the address bar still says `/meal`. The same is true of any unknown path such as `/settings`.

The word **Nourish** in the header is a link. Clicking it calls `preventDefault` and navigates to `/`.

The service worker answers document navigations from the cached `index.html`, including a refresh on `/history`, `/meals`, `/goal`, `/day/…`, or `/meal/…`.

## Shell

`index.html` paints `#070911` on `html` and `body` before JavaScript, then mounts `<nourish-app>` and loads `/bundle.js`. The element renders in an open Lit shadow root, so its CSS does not apply to the page and the page CSS does not apply inside it. All UI CSS lives in [src/client/styles.global.ts](src/client/styles.global.ts).

The host is at least one viewport tall. Background is `#0c0d18` with a soft gold radial glow at the top. Content column max width is `45rem` (`--content`). Typeface is Inter (bundled `woff2`, weights 300–700, latin), then Segoe UI, then sans-serif.

### Header

- Small gold uppercase wordmark **Nourish**, letter-spacing `0.22em`.
- Large page title under it (`1.6rem`). The title is the only `<h1>` and changes with the page. History’s inner heading “Days” is an `<h2>`, separate from this title.
- Round menu button, top right, `2.75rem`, panel color `#171924`, `aria-label="Account and menu"`, `aria-haspopup="dialog"`, `aria-expanded` follows whether the sheet is open.
  - Signed out, or still checking, or auth not configured: stroke icon of a person in a circle. This is not a hamburger. The `.hamburger` CSS rules are unused.
  - Signed in with an Auth0 `picture`: that image, `object-fit: cover`, empty alt.
  - Signed in without a picture: initials. Source is `name`, else `email`, else `?`. Split on whitespace or `@`. First character of the first two parts, uppercased. One word yields one letter.

On viewports `54rem` and narrower, header text is padded on the right so it does not run under the button.

### Status lines

Both use class `offline-note` (gold, `0.85rem`) and `role="status"`.

- If `navigator.onLine` is false: **Offline. Your log stays on this device.**
- If `syncNote` is non-empty, a second line shows that string. It is cleared to empty after a clean sync.

`syncNote` is set to:

- `Sign in again to sync.` when the access token cannot be refreshed, or the API returns 401.
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
  - `signed-in`: display name, else email, else **Signed in**. No email line under the name. No avatar in the panel.
  - otherwise: **Log in** (gold pill) and **Sign up** (transparent pill, light border).
- Nav buttons, left aligned, `1.15rem`, no icons: **Today**, **History**, **Meals**, **Goal**, then **Share**. Today, History, Meals, and Goal each navigate and close the menu. Share is the next row in that list, not a separate footer.
  - The URL is the app root: `origin + "/"`, not the page you are on.
  - A phone or tablet (`pointer: coarse` and `hover: none`) with `navigator.share` opens the system share sheet. Title is **Nourish**, and the URL is that root. Dismissing the sheet does nothing else. A successful share closes the menu. If the sheet fails for another reason, it falls through to copy.
  - Desktop, and any device without the share sheet, copies that URL. The button label becomes **Copied** for 1.6 seconds. The menu stays open. If the clipboard API refuses, it falls back to selecting a hidden textarea and `document.execCommand("copy")`.
- **Sign out** only when signed in. It sits at the bottom of the panel (`margin-top: auto`), below Share, outline pill, muted text. It closes the menu, calls Auth0 logout back to this origin, and sets the in-memory account to signed out. It does not clear `nourish-state`, the queue, or the activity document.

There is no close button. There is no link to a day, a meal, or new-meal.

## Today

Rendered for page `today`.

Summary block:

- Kicker **Today** (uppercase, muted, tracked).
- If a goal applies to today, an em dash and a status label: **On track**, **Drifting**, **Running hot**, or **Over the window**. See [Color](#color).
- Huge number (`4.4rem`) of today’s calorie total. Color is the tone color when a goal exists, otherwise `--ink` (`#f4efe6`).
- Beside it, muted: `/ {goal} calories` when a goal exists, otherwise just `calories`. The total is not formatted with thousands separators. The goal number is not either.

Rows: non-removed entries whose local date is today, passed through the bubble grouper, newest bubble first. Empty copy: **Nothing logged yet. Add a bite when you eat it.**

The bottom action dock is shown on Today and on a day page only.

## A past or current day (`/day/YYYY-MM-DD`)

Same summary as Today, except the kicker is `formatDayLabel`:

- The local today key: **Today**
- Yesterday: **Yesterday**
- Otherwise the runtime locale’s short weekday, short month, and numeric day (for example `Tue, Oct 6`).

Status label and tone color use that day’s goal and a weighted window that ends on that day, not on today.

Empty copy: **Nothing logged this day.**

The dock is the same four buttons. Calories added here are not stamped “now”. See [When a new row is stamped](#when-a-new-row-is-stamped).

Future dates can be opened from the address bar. The summary still renders. Adds use the past-day stamper, which anchors at noon on that date. The calendar itself does not make future cells into buttons.

## Bottom dock

Fixed to the bottom, centered, max `45rem`, four equal columns, gap `0.55rem`. A gradient from the canvas covers the bottom so rows can scroll underneath. Main content has `7.5rem` of bottom padding.

| Button | Label | Style | Action |
| --- | --- | --- | --- |
| 1 | `+50` | Gold `#d7b07a`, ink `#1b140c`, min-height `3.4rem`, radius `1.1rem` | `addCalories(50)` |
| 2 | `+100` | same | `addCalories(100)` |
| 3 | `+500` | same | `addCalories(500)` |
| 4 | `Meals` | Panel background, light text. `aria-haspopup="menu"`, `aria-expanded` | Toggles the meal picker and closes any kebab |

There is no custom-calorie field on this dock.

### Meal picker

Opens above the Meals button (`bottom: 5.6rem`, right-aligned, max width `18rem`, max height `min(58vh, 26rem)`, scrolls). A transparent full-screen backdrop click closes it. Bubbles are pills.

1. **Create a new meal** — quieter styling, no shadow. Goes to `/meals/new`.
2. One bubble per saved meal that is not removed, in stored array order (newest creates are unshifted to the front). Each bubble shows the title in title case and the calorie number. No unit word. Click logs `meal.calories` with `mealId`, and copies `title` and `description` onto the new entry. The picker closes.

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

- Left, field-colored: **−100**, **−25**
- Right, gold: **+25**, **+100**

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

Each non-removed meal is a card:

- Title, title-cased, `1.25rem`.
- Meta: `{description or "No description"} · {calories} calories`. Description is not title-cased.
- Kebab, key `meal:{id}`:
  - **Edit** — no icon. Opens `/meal/{id}`.
  - **Remove** — muted red text, no icon. Sets `removed: true` and enqueues `meal.remove`. Does not delete or change log rows that point at this id.

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

There is no delete button on this form. Delete is the meal-list kebab.

## Goal

Path `/goal`. One form.

- Label **Calories to stay near**, input `#goal-calories`, `type="number"`, `min="1"`.
- The value shown is the goal in effect **today**, or `2000` if today has no goal yet. It is not a separate draft until submit. Re-rendering after a goal save is unlikely to be seen because save navigates away.
- Check button, `aria-label="Save goal"`.
- Help text, verbatim:

  > Color uses a seven-day window. Today counts fully, yesterday half, and each older day a little less. Under the goal pulls the color back toward green. 150 over the weighted window is yellow. 300 over is red.

Save requires an integer greater than 0. It appends a new goal `{ id, calories, setAt }` with `setAt` equal to now. It does not change older goal rows. It enqueues `goal.create` with `occurredAt` and body `setAt` both set to that timestamp, then `pushState`s `/`.

### Which goal a day uses

`goalForDay`: among goals whose `setAt` is a valid time and is **on or before the last millisecond of that local day**, pick the greatest `setAt`. If two share `setAt`, the greater `id` string wins.

So a goal set on Tuesday afternoon does not apply to Tuesday morning’s calendar math for Monday, and it does apply to Tuesday. A day before every goal has no goal: no status label, ink-colored total, no `/ N` in the summary.

`latestGoal` (greatest `setAt`, then id) exists for callers that want “the current goal” without a day. The live screen uses `goalForDay` for today instead, which matches `latestGoal` unless a goal is stamped in the future.

### Color

Constants in [src/shared/util.score.ts](src/shared/util.score.ts):

- Green `rgb(111, 191, 132)`
- Yellow `rgb(224, 184, 74)`
- Red `rgb(214, 84, 78)`
- Yellow threshold `150`
- Red threshold `300`

For a viewed day D and that day’s goal G, look at D, D−1, … D−6. Each slot contributes `(calories that day − G) * weight`.

| Days before D | Weight |
| --- | --- |
| 0 | 1 |
| 1 | 1/2 |
| 2 | 1/3 |
| 3 | 1/4 |
| 4 | 1/5 |
| 5 | 1/6 |
| 6 | 1/7 |

The same G is subtracted for every slot. Older days do not use their own historical goal inside this sum. A day under goal produces a negative term and can pull a later overage back toward green. Removed entries are excluded. Empty days count as 0 − G, which is negative.

| Weighted sum | Label | Color |
| --- | --- | --- |
| ≤ 0 | On track | Solid green |
| > 0 and < 150 | Drifting | Linear mix from green to yellow |
| Exactly 150 | Running hot | Solid yellow. The label flips at 150, the color reaches yellow at 150 |
| > 150 and < 300 | Running hot | Linear mix from yellow to red |
| ≥ 300 | Over the window | Solid red |

Mixing is per channel, rounded, clamped to 0..1.

The big number on Today and on a day page uses this color. History list totals use it whenever that day has a goal. Calendar counts use it only for in-month cells that have a goal.

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
- `authorizationParams.audience` from the table
- `redirect_uri: window.location.origin`

On load, if the query has both `code` and `state`, `handleRedirectCallback` runs, then `replaceState` leaves only `pathname` + `hash`. That path is the only time `recordLogin` runs. A silent `getTokenSilently` refresh does not increment the login count.

If Auth0 says the user is authenticated and `getUser()` has a `sub`, status is `signed-in` with `sub`, `name`, `email`, and `picture` (missing strings become empty). Otherwise signed out.

**Log in** calls `loginWithRedirect` with the same audience and redirect. **Sign up** adds `screen_hint: "signup"`.

**Sign out** calls `logout` with `returnTo` set to this origin. Auth0 leaves the page. The food log remains on the device.

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
| `nourish-state` | `{ entries, meals, goals }`. This is the open document |
| `nourish-queue` | `{ deviceId, syncedUserId, ops }` |
| `nourish-account:{userId}` | Stash `{ state, queue }` for a previous signed-in user on this device |
| `nourish-activity` | Activity counters. One document for the browser profile, not keyed by user |

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
- Each goal: `goal.create` at the goal’s `setAt`, `count: false`.

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
| `goal.create` | `calories` positive integer, `setAt` non-empty | Insert if that id is new. Goals are never updated or removed |

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

**Goal:** `id` (min 1), `calories` (positive integer), `setAt` (min 1).

**NutritionState:** `entries`, `meals`, `goals`.

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

Patches, meal updates, and removes do not increment counters. Ops with `count: false` do not increment counters. `currentGoal` is still compared on every `recordOps` call.

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
| `operations` | Append-only. `op_id` UUID primary key. `user_id` FK cascade. `device_id` UUID nullable. `entity_id`, `op_type` check constraint for the seven types, `occurred_at`, `received_at` default now, `body` JSONB. Index `(user_id, occurred_at, op_id)`. Insert is `ON CONFLICT (op_id) DO NOTHING` |
| `calorie_entries` | Folded read model, rewritten on each sync. Positive calories, `eaten_at`, optional meal fields, `removed` default false |
| `meals` | Same. Title required, description default `''`, calories ≥ 0, `removed` |
| `goals` | Same. Positive calories, `set_at`. Index `(user_id, set_at)` |

On sync the three read-model tables for that user are deleted and reinserted from the fold, including removed rows. `GET /api/state` does **not** read those tables. It loads `operations` and folds them. Inserting the user row on read uses `ON CONFLICT DO NOTHING` and does not refresh email.

Deleting a `nourish_users` row cascades to ops and read models. The identity console does not do that.

Connection string, first hit wins: `NETLIFY_DB_URL`, `NETLIFY_DATABASE_URL`, `DATABASE_URL`, then `getConnectionString()` from `@netlify/database`. If none is available, `liveStore()` throws and the function returns 500.

### File store

Local server only. [src/server/file-store.ts](src/server/file-store.ts) writes `data/nourish.json` (gitignored). Shape is `{ users, ops, owners }`. Writes are serialized on one promise chain. `read` can insert the user when an email is present. `deviceId` is ignored. Same `acceptOps` rules as Postgres.

## HTTP surface

[src/server/handle.ts](src/server/handle.ts). Paths match `/api/state` and `/api/ops` with or without a trailing slash, including the Netlify form `/.netlify/functions/api/state` and `/.netlify/functions/api/ops`.

| Request | Auth | Result |
| --- | --- | --- |
| `OPTIONS` any | no | 204 empty |
| `GET /api/state` | bearer | 200 nutrition state. Creates the user row if needed. Empty log is `{ entries: [], meals: [], goals: [] }` |
| `POST /api/ops` | bearer | 200 `{ results, state }` |
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

Netlify [netlify.toml](netlify.toml): build command `npm run build`, publish `dist/client`, functions bundler esbuild. Redirect `/api/*` to `/.netlify/functions/api/:splat` status 200 force. Redirect `/*` to `/index.html` status 200. The function exports paths `/api/ops` and `/api/state` and methods GET, POST, OPTIONS.

`.env.example` lists every variable. `.env` is gitignored, along with `node_modules/`, `dist/`, `data/`, and logs.

Dependencies that ship: `lit`, `@lit/context` (declared; the live app does not call the context API), `zod` 4, `@auth0/auth0-spa-js`, `@neondatabase/serverless`, `@netlify/database`, `@netlify/functions`, `jose`.

## Tests that lock behavior

Shared fold tests: later `occurredAt` wins even if the older patch is applied second; a patch logged “before” its create still applies once both are sorted; collapsing a quick-add group keeps one row and tombstones the other; a title patch does not create a meal; a goal set on Oct 1 is what Oct 2 uses, and a goal set on Oct 8 is what Oct 9 uses; a day before every goal has no goal; legacy `goal` migrates once.

Accept tests: a fractional calorie is rejected and a sibling op in the same batch still applies; repeating an `opId` is `duplicate` and does not double the calories; another user’s `opId` or `entityId` is `conflict`.

API tests against the file store: anonymous GET and POST are 401; an unknown bearer is 401; ops survive a new `FileStore` on the same file; a later patch beats an earlier one; a second user’s patch of the first user’s entry is `conflict`; missing `ops` is 400; `public/sw.js` contains the `/api/` bypass.

Queue tests: backfill of an already-removed entry orders create then remove, both `count: false`, and folds to `removed: true`; restoring account A after account B was queued does not keep B’s ops; `resetOpenDocument` keeps `deviceId` and clears ops and `syncedUserId`.

There is no browser test and no screenshot test in the repo.

## Source map

Every file, and whether the running app uses it.

| Path | Used by the live app? | Role |
| --- | --- | --- |
| [src/client/app.ts](src/client/app.ts) | Yes. Bundle entry | All pages, dock, menus, edit sheet, routing, session |
| [src/client/styles.global.ts](src/client/styles.global.ts) | Yes | All shadow CSS. Includes unused `.hamburger`, `.save-button`, `.text-button`, `.meal-description`, `.calorie-unit`, `.goal-note` rules |
| [src/client/util.auth.ts](src/client/util.auth.ts) | Yes | Auth0 client |
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

Open `/`. Auth becomes `unconfigured`, `signed-out`, or briefly `checking`. Today shows `0` in the ink color, the word calories, and the empty sentence.

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

Save 2000 on Monday. Save 1800 on Friday. Monday through Thursday use 2000. Friday and after use 1800, until another goal is saved. The color window on Friday still subtracts 1800 from Monday, not 2000.

### Install

Browser install uses the manifest. iOS can add to home screen via the Apple meta tags and touch icon. Next launch is standalone, portrait. The worker serves the shell if the network is down. API calls still need the network; until then the on-device log is the UI.
