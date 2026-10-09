import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
  CalorieEntry,
  Meal,
  NutritionState,
} from "../shared/type.nutrition.js";
import {
  addDays,
  dateKey,
  formatDayLabel,
  formatTime,
  parseDateKey,
  timeValue,
  todayKey,
  withTime,
} from "../shared/util.dates.js";
import {
  toneColor,
  toneLabel,
  weightedOver,
  dayTotal,
} from "../shared/util.score.js";
import { loadState, saveState } from "./util.storage.js";
import { appStyles } from "./styles.global.js";

type PageName = "today" | "history" | "meals" | "goal" | "meal" | "day";

const QUICK_WINDOW_MS = 60_000;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthKey(key: string): string {
  return key.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year ?? 1970, (monthNumber ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year ?? 1970, (monthNumber ?? 1) - 1, 1).toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric",
    },
  );
}

function monthCells(month: string): { key: string; inMonth: boolean }[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year ?? 1970, (monthNumber ?? 1) - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: { key: string; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    cells.push({
      key: dateKey(date),
      inMonth: date.getMonth() === first.getMonth(),
    });
  }
  while (cells.length > 35 && cells.slice(-7).every((cell) => !cell.inMonth))
    cells.splice(-7, 7);
  return cells;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[^\p{L}])(\p{L})/gu,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    );
}

type ShownEntry = {
  key: string;
  entries: CalorieEntry[];
  calories: number;
  timestamp: string;
  mealId?: string;
};

function shownEntries(entries: CalorieEntry[]): ShownEntry[] {
  const ordered = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const shown: ShownEntry[] = [];
  let quick: CalorieEntry[] = [];
  let quickStart = 0;

  const flushQuick = (): void => {
    if (!quick.length) return;
    const grouped = quick;
    const latest = grouped[grouped.length - 1];
    if (!latest) return;
    shown.push({
      key: grouped.map((entry) => entry.id).join(":"),
      entries: grouped,
      calories: grouped.reduce((sum, entry) => sum + entry.calories, 0),
      timestamp: latest.timestamp,
    });
    quick = [];
  };

  for (const entry of ordered) {
    if (entry.mealId) {
      shown.push({
        key: entry.id,
        entries: [entry],
        calories: entry.calories,
        timestamp: entry.timestamp,
        mealId: entry.mealId,
      });
      continue;
    }
    const time = new Date(entry.timestamp).getTime();
    if (!quick.length || time - quickStart > QUICK_WINDOW_MS) {
      flushQuick();
      quick = [entry];
      quickStart = time;
      continue;
    }
    quick.push(entry);
  }
  flushQuick();
  return shown.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

@customElement("nourish-app")
export class NourishApp extends LitElement {
  static override styles = appStyles;

  @state() private state: NutritionState = loadState();
  @state() private page: PageName = "today";
  @state() private selectedMealId = "";
  @state() private selectedDayKey = "";
  @state() private menuOpen = false;
  @state() private mealPickerOpen = false;
  @state() private kebabKey = "";
  @state() private offline = !navigator.onLine;
  @state() private historyMode: "list" | "calendar" = "list";
  @state() private calendarMonth = monthKey(todayKey());
  @state() private editKey = "";
  @state() private editMeal = false;
  @state() private editCalories = "";
  @state() private editTitle = "";
  @state() private editDescription = "";
  private editIds: string[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRoute();
    window.addEventListener("popstate", this.syncRoute);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    this.registerWorker();
  }

  override disconnectedCallback(): void {
    window.removeEventListener("popstate", this.syncRoute);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    document.removeEventListener("visibilitychange", this.onVisibility);
    super.disconnectedCallback();
  }

  private onOnline = (): void => {
    this.offline = false;
  };

  private onOffline = (): void => {
    this.offline = true;
  };

  private onVisibility = (): void => {
    if (
      document.visibilityState !== "visible" ||
      !("serviceWorker" in navigator)
    )
      return;
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update());
  };

  private registerWorker(): void {
    if (!("serviceWorker" in navigator)) return;
    void navigator.storage?.persist?.().catch(() => undefined);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        try {
          if (sessionStorage.getItem("nourish-reloading") === "1") return;
          sessionStorage.setItem("nourish-reloading", "1");
        } catch {
          return;
        }
        window.location.reload();
      });
    }
    try {
      sessionStorage.removeItem("nourish-reloading");
    } catch {
      /* Storage can be blocked. Registration still has to run. */
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => undefined);
  }

  private syncRoute = (): void => {
    this.closeEdit();
    const path = window.location.pathname;
    const meal = path.match(/^\/meal\/([^/]+)\/?$/);
    if (meal) {
      this.page = "meal";
      this.selectedMealId = decodeURIComponent(meal[1] ?? "");
    } else if (path.startsWith("/day/")) {
      const key = decodeURIComponent(path.slice(5)).replace(/\/$/, "");
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        dateKey(parseDateKey(key)) === key
      ) {
        this.page = "day";
        this.selectedDayKey = key;
      } else this.page = "history";
    } else if (path.startsWith("/history")) this.page = "history";
    else if (path.startsWith("/meals")) this.page = "meals";
    else if (path.startsWith("/goal")) this.page = "goal";
    else this.page = "today";
  };

  private navigate(page: PageName): void {
    const path = page === "today" ? "/" : `/${page}`;
    window.history.pushState({}, "", path);
    this.page = page;
    this.menuOpen = false;
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private openMeal(id: string): void {
    window.history.pushState({}, "", `/meal/${encodeURIComponent(id)}`);
    this.page = "meal";
    this.selectedMealId = id;
    this.menuOpen = false;
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private openDay(key: string): void {
    window.history.pushState({}, "", `/day/${key}`);
    this.page = "day";
    this.selectedDayKey = key;
    this.menuOpen = false;
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private commit(next: NutritionState): void {
    this.state = next;
    saveState(next);
  }

  private addCalories(calories: number, mealId?: string): void {
    const meal = mealId
      ? this.state.meals.find((item) => item.id === mealId)
      : undefined;
    const entry: CalorieEntry = {
      id: crypto.randomUUID(),
      calories,
      timestamp: new Date().toISOString(),
      mealId,
      mealTitle: meal?.title,
      mealDescription: meal?.description,
    };
    this.commit({ ...this.state, entries: [entry, ...this.state.entries] });
    this.mealPickerOpen = false;
  }

  private updateShownTime(shown: ShownEntry, time: string): void {
    const ids = new Set(shown.entries.map((entry) => entry.id));
    this.commit({
      ...this.state,
      entries: this.state.entries.map((item) =>
        ids.has(item.id)
          ? { ...item, timestamp: withTime(item.timestamp, time) }
          : item,
      ),
    });
  }

  private removeShown(shown: ShownEntry): void {
    const ids = new Set(shown.entries.map((entry) => entry.id));
    this.commit({
      ...this.state,
      entries: this.state.entries.map((entry) =>
        ids.has(entry.id) ? { ...entry, removed: true } : entry,
      ),
    });
    this.kebabKey = "";
  }

  private removeMeal(id: string): void {
    this.commit({
      ...this.state,
      meals: this.state.meals.map((meal) =>
        meal.id === id ? { ...meal, removed: true } : meal,
      ),
    });
    this.kebabKey = "";
  }

  private toggleKebab(key: string): void {
    this.mealPickerOpen = false;
    this.menuOpen = false;
    this.kebabKey = this.kebabKey === key ? "" : key;
  }

  private openClock(shown: ShownEntry, event: Event): void {
    const trigger = event.currentTarget as HTMLElement | null;
    const input = trigger
      ?.closest(".entry-card")
      ?.querySelector<HTMLInputElement>("input.clock-input");
    if (!input) return;
    input.value = timeValue(shown.timestamp);
    this.kebabKey = "";
    try {
      input.showPicker();
    } catch {
      /* The clock is already open, or this browser will not show one. */
    }
  }

  private closeEdit(): void {
    this.editKey = "";
    this.editIds = [];
  }

  private beginEdit(shown: ShownEntry): void {
    const entry = shown.entries[shown.entries.length - 1];
    const meal = shown.mealId
      ? this.state.meals.find((item) => item.id === shown.mealId)
      : undefined;
    this.kebabKey = "";
    this.menuOpen = false;
    this.mealPickerOpen = false;
    this.editIds = shown.entries.map((item) => item.id);
    this.editMeal = Boolean(shown.mealId);
    this.editCalories = String(shown.calories);
    this.editTitle = titleCase(entry?.mealTitle ?? meal?.title ?? "");
    this.editDescription = entry?.mealDescription ?? meal?.description ?? "";
    this.editKey = shown.key;
    this.renderRoot.querySelector<HTMLElement>(":focus")?.blur();
  }

  private nudgeCalories(delta: number): void {
    const current = Number(this.editCalories);
    const base = Number.isFinite(current) ? current : 0;
    this.editCalories = String(Math.max(1, Math.round(base + delta)));
  }

  private saveEdit(event: Event): void {
    event.preventDefault();
    const calories = Number(this.editCalories);
    if (!Number.isInteger(calories) || calories <= 0) return;
    const keepId = this.editIds[this.editIds.length - 1];
    if (!keepId) return;
    const ids = new Set(this.editIds);
    if (this.editMeal) {
      const title = titleCase(this.editTitle.trim());
      const description = this.editDescription.trim();
      if (!title) return;
      this.commit({
        ...this.state,
        entries: this.state.entries.map((entry) =>
          entry.id === keepId
            ? {
                ...entry,
                calories,
                mealTitle: title,
                mealDescription: description,
              }
            : entry,
        ),
      });
    } else {
      this.commit({
        ...this.state,
        entries: this.state.entries.map((entry) => {
          if (entry.id === keepId) return { ...entry, calories };
          if (ids.has(entry.id)) return { ...entry, removed: true };
          return entry;
        }),
      });
    }
    this.closeEdit();
  }

  private visibleMeals(): Meal[] {
    return this.state.meals.filter((meal) => !meal.removed);
  }

  private saveMeal(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const meal: Meal = {
      id: crypto.randomUUID(),
      title: titleCase(String(data.get("title") ?? "").trim()),
      description: String(data.get("description") ?? "").trim(),
      calories: Number(data.get("calories") ?? 0),
    };
    if (!meal.title || !Number.isFinite(meal.calories)) return;
    this.commit({ ...this.state, meals: [meal, ...this.state.meals] });
    form.reset();
  }

  private updateMeal(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const title = titleCase(String(data.get("title") ?? "").trim());
    const description = String(data.get("description") ?? "").trim();
    const calories = Number(data.get("calories") ?? 0);
    if (!title || !Number.isFinite(calories) || calories < 0) return;
    this.commit({
      ...this.state,
      meals: this.state.meals.map((meal) =>
        meal.id === this.selectedMealId
          ? { ...meal, title, description, calories }
          : meal,
      ),
    });
    this.navigate("today");
  }

  private saveGoal(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const calories = Number(new FormData(form).get("calories") ?? 0);
    if (!Number.isFinite(calories) || calories <= 0) return;
    this.commit({ ...this.state, goal: { calories } });
    this.navigate("today");
  }

  private todayEntries(): CalorieEntry[] {
    const today = todayKey();
    return this.state.entries
      .filter(
        (entry) =>
          !entry.removed && dateKey(new Date(entry.timestamp)) === today,
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private dayEntries(key: string): CalorieEntry[] {
    return this.state.entries
      .filter(
        (entry) => !entry.removed && dateKey(new Date(entry.timestamp)) === key,
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private renderDay() {
    const key = this.selectedDayKey;
    const label = formatDayLabel(key, todayKey());
    const total = dayTotal(this.state.entries, key);
    const goal = this.state.goal?.calories;
    const weighted = goal ? weightedOver(this.state.entries, key, goal) : 0;
    const color = goal ? toneColor(weighted) : "var(--ink)";
    const entries = this.dayEntries(key);
    return html`
      <section class="day-summary">
        <p class="day-status">
          <span class="day-kicker">${label}</span>
          ${goal ? html`<span class="status-label">— ${toneLabel(weighted)}</span>` : ""}
        </p>
        <p class="calorie-line">
          <span class="calorie-total" style="color: ${color}">${total}</span>
          <span class="calorie-goal">${goal ? `/ ${goal} ` : ""}calories</span>
        </p>
      </section>
      ${
        entries.length
          ? html`<ul class="entry-list">
              ${shownEntries(entries).map((entry) => this.renderEntry(entry))}
            </ul>`
          : html`<p class="empty-note">Nothing logged this day.</p>`
      }
    `;
  }

  private renderToday() {
    const today = todayKey();
    const total = dayTotal(this.state.entries, today);
    const goal = this.state.goal?.calories;
    const weighted = goal ? weightedOver(this.state.entries, today, goal) : 0;
    const color = goal ? toneColor(weighted) : "var(--ink)";
    return html`
      <section class="day-summary">
        <p class="day-status">
          <span class="day-kicker">Today</span>
          ${goal ? html`<span class="status-label">— ${toneLabel(weighted)}</span>` : ""}
        </p>
        <p class="calorie-line">
          <span class="calorie-total" style="color: ${color}">${total}</span>
          <span class="calorie-goal">${goal ? `/ ${goal} ` : ""}calories</span>
        </p>
      </section>
      ${
        this.todayEntries().length
          ? html`<ul class="entry-list">
              ${shownEntries(this.todayEntries()).map((entry) => this.renderEntry(entry))}
            </ul>`
          : html`<p class="empty-note">
              Nothing logged yet. Add a bite when you eat it.
            </p>`
      }
      <div class="action-dock">
        <button class="calorie-button" @click=${() => this.addCalories(50)}>
          +50
        </button>
        <button class="calorie-button" @click=${() => this.addCalories(100)}>
          +100
        </button>
        <button class="calorie-button" @click=${() => this.addCalories(500)}>
          +500
        </button>
        <button
          class="meal-button"
          aria-haspopup="menu"
          aria-expanded=${this.mealPickerOpen ? "true" : "false"}
          @click=${() => {
            this.kebabKey = "";
            this.mealPickerOpen = !this.mealPickerOpen;
          }}
        >
          Meals
        </button>
      </div>
      ${this.mealPickerOpen ? this.renderMealPicker() : ""}
    `;
  }

  private renderKebab(key: string, items: TemplateResult) {
    const open = this.kebabKey === key;
    return html`<div class="kebab">
      <button
        class="icon-button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded=${open ? "true" : "false"}
        @click=${() => this.toggleKebab(key)}
      >
        <svg class="dots" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6"></circle>
          <circle cx="12" cy="12" r="1.6"></circle>
          <circle cx="12" cy="19" r="1.6"></circle>
        </svg>
      </button>
      ${
        open
          ? html`<div
                class="kebab-backdrop"
                @click=${() => (this.kebabKey = "")}
              ></div>
              <div class="kebab-menu" role="menu">${items}</div>`
          : ""
      }
    </div>`;
  }

  private renderEntry(shown: ShownEntry) {
    const meal = this.state.meals.find((item) => item.id === shown.mealId);
    const title =
      shown.entries.find((entry) => entry.mealTitle)?.mealTitle ?? meal?.title;
    const description = shown.mealId
      ? (shown.entries[0]?.mealDescription?.trim() ?? "")
      : "";
    return html`<li
      class="entry-card ${this.kebabKey === shown.key ? "menu-open" : ""}"
    >
      <div class="entry-row">
        <div class="entry-line">
          <span class="log-amount">
            <button
              class="log-calories"
              type="button"
              @click=${() => this.beginEdit(shown)}
            >
              ${shown.calories}
            </button>
            <span class="log-unit">calories</span>
          </span>
          <span class="log-time-wrap">
            <button
              class="log-time"
              type="button"
              @click=${(event: Event) => this.openClock(shown, event)}
            >
              ${formatTime(shown.timestamp)}
            </button>
            <input
              class="clock-input"
              type="time"
              step="60"
              tabindex="-1"
              aria-hidden="true"
              .value=${timeValue(shown.timestamp)}
              @change=${(event: Event) =>
                this.updateShownTime(
                  shown,
                  (event.target as HTMLInputElement).value,
                )}
            />
          </span>
          ${
            title
              ? meal
                ? html`<button
                    class="log-meal"
                    type="button"
                    @click=${() => this.openMeal(meal.id)}
                  >
                    ${titleCase(title)}
                  </button>`
                : html`<span class="log-unit">${titleCase(title)}</span>`
              : ""
          }
        </div>
        ${this.renderKebab(
          shown.key,
          html`<button
              class="popover-button"
              role="menuitem"
              @click=${() => this.beginEdit(shown)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 19.5l1.1-4.2L16.2 4.7l3.1 3.1L8.7 18.4z"></path>
                <path d="M13.8 7.1l3.1 3.1"></path>
              </svg>
              <span>Edit</span>
            </button>
            <button
              class="popover-button"
              role="menuitem"
              @click=${(event: Event) => this.openClock(shown, event)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8"></circle>
                <path d="M12 8v4.5l3 2"></path>
              </svg>
              <span>Change time</span>
            </button>
            <button
              class="popover-button kebab-remove"
              role="menuitem"
              @click=${() => this.removeShown(shown)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 7h15"></path>
                <path d="M9 7V4.5h6V7"></path>
                <path d="M7.5 7l.8 12.5h7.4l.8-12.5"></path>
                <path d="M10 11v5.5"></path>
                <path d="M14 11v5.5"></path>
              </svg>
              <span>Remove</span>
            </button>`,
        )}
      </div>
      ${description ? html`<p class="entry-note">${description}</p>` : ""}
    </li>`;
  }

  private renderEdit() {
    if (!this.editKey) return "";
    return html`<div
      class="edit-sheet"
      @click=${() => this.closeEdit()}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === "Escape") this.closeEdit();
      }}
    >
      <form
        class="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-heading"
        @submit=${this.saveEdit}
        @click=${(event: Event) => event.stopPropagation()}
      >
        <h2 id="edit-heading" class="edit-heading">
          ${this.editMeal ? "Edit this serving" : "Edit calories"}
        </h2>
        ${
          this.editMeal
            ? html`<label class="field-label" for="edit-use-title">Title</label>
                <input
                  class="text-input"
                  id="edit-use-title"
                  .value=${live(this.editTitle)}
                  required
                  @input=${(event: Event) => {
                    this.editTitle = (event.target as HTMLInputElement).value;
                  }}
                />
                <label class="field-label" for="edit-use-description"
                  >Description</label
                >
                <textarea
                  class="description-input"
                  id="edit-use-description"
                  rows="3"
                  .value=${live(this.editDescription)}
                  @input=${(event: Event) => {
                    this.editDescription = (
                      event.target as HTMLTextAreaElement
                    ).value;
                  }}
                ></textarea>`
            : ""
        }
        <label class="field-label" for="edit-calories">Calories</label>
        <input
          class="number-input edit-calories"
          id="edit-calories"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          required
          .value=${live(this.editCalories)}
          @input=${(event: Event) => {
            this.editCalories = (event.target as HTMLInputElement).value;
          }}
        />
        <div class="calorie-nudge">
          <div class="nudge-side">
            <button
              class="nudge-button"
              type="button"
              @click=${() => this.nudgeCalories(-100)}
            >
              −100
            </button>
            <button
              class="nudge-button"
              type="button"
              @click=${() => this.nudgeCalories(-25)}
            >
              −25
            </button>
          </div>
          <div class="nudge-side">
            <button
              class="nudge-button nudge-plus"
              type="button"
              @click=${() => this.nudgeCalories(25)}
            >
              +25
            </button>
            <button
              class="nudge-button nudge-plus"
              type="button"
              @click=${() => this.nudgeCalories(100)}
            >
              +100
            </button>
          </div>
        </div>
        <button class="check-button" type="submit" aria-label="Save">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5"></path>
          </svg>
        </button>
      </form>
    </div>`;
  }

  private renderMealPicker() {
    const meals = this.visibleMeals();
    return html`<div
        class="popover-backdrop"
        @click=${() => (this.mealPickerOpen = false)}
      ></div>
      <div
        class="meal-popover"
        role="menu"
        @click=${(event: Event) => event.stopPropagation()}
      >
        ${
          meals.length
            ? meals.map(
                (meal) =>
                  html`<button
                    class="popover-button"
                    role="menuitem"
                    @click=${() => this.addCalories(meal.calories, meal.id)}
                  >
                    <span>${titleCase(meal.title)}</span>
                    <span class="popover-calories">${meal.calories}</span>
                  </button>`,
              )
            : html`<button
                class="popover-button popover-create"
                role="menuitem"
                @click=${() => this.navigate("meals")}
              >
                Create a meal
              </button>`
        }
      </div>`;
  }

  private showMonth(delta: number): void {
    const next = shiftMonth(this.calendarMonth, delta);
    if (next > monthKey(todayKey())) return;
    this.calendarMonth = next;
  }

  private renderHistory() {
    const today = todayKey();
    return html`<section>
      <div class="section-heading">
        <h2 class="section-title">Days</h2>
        <div class="view-toggle" role="group" aria-label="History layout">
          <button
            type="button"
            aria-pressed=${this.historyMode === "list" ? "true" : "false"}
            @click=${() => (this.historyMode = "list")}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed=${this.historyMode === "calendar" ? "true" : "false"}
            @click=${() => (this.historyMode = "calendar")}
          >
            Calendar
          </button>
        </div>
      </div>
      ${this.historyMode === "calendar" ? this.renderCalendar(today) : this.renderHistoryList(today)}
    </section>`;
  }

  private renderHistoryList(today: string) {
    const days = Array.from({ length: 30 }, (_, index) =>
      addDays(today, -index),
    );
    const goal = this.state.goal?.calories;
    return html`<ul class="day-list">
      ${days.map((day) => {
        const total = dayTotal(this.state.entries, day);
        const color = goal
          ? toneColor(weightedOver(this.state.entries, day, goal))
          : "var(--ink)";
        return html`<li class="day-card day-link">
          <button
            type="button"
            class="day-button"
            @click=${() => this.openDay(day)}
          >
            <span class="entry-line">
              <span class="log-amount">
                <span class="log-calories" style="color: ${color}"
                  >${total}</span
                >
                <span class="log-unit">calories</span>
              </span>
              <span class="log-unit">${formatDayLabel(day, today)}</span>
            </span>
          </button>
        </li>`;
      })}
    </ul>`;
  }

  private renderCalendar(today: string) {
    const goal = this.state.goal?.calories;
    const current = monthKey(today);
    return html`<div class="calendar-card">
      <div class="calendar-nav">
        <button
          class="icon-button"
          type="button"
          aria-label="Previous month"
          @click=${() => this.showMonth(-1)}
        >
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6.5L8.5 12l6 5.5"></path>
          </svg>
        </button>
        <p class="calendar-month">${monthLabel(this.calendarMonth)}</p>
        <button
          class="icon-button"
          type="button"
          aria-label="Next month"
          ?disabled=${this.calendarMonth >= current}
          @click=${() => this.showMonth(1)}
        >
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 6.5l6 5.5-6 5.5"></path>
          </svg>
        </button>
      </div>
      <div class="calendar-grid">
        ${WEEKDAYS.map((day) => html`<span class="calendar-weekday">${day}</span>`)}
        ${monthCells(this.calendarMonth).map((cell) => {
          const happened = cell.key <= today;
          const total = happened ? dayTotal(this.state.entries, cell.key) : 0;
          const color =
            happened && cell.inMonth && goal
              ? toneColor(weightedOver(this.state.entries, cell.key, goal))
              : "var(--muted)";
          const classes = `calendar-day ${cell.inMonth ? "" : "outside"} ${cell.key === today ? "is-today" : ""}`;
          return happened
            ? html`<button
                type="button"
                class=${classes}
                @click=${() => this.openDay(cell.key)}
              >
                <span class="calendar-date">${Number(cell.key.slice(-2))}</span>
                <span class="calendar-calories" style="color: ${color}"
                  >${total}</span
                >
              </button>`
            : html`<div class=${classes}>
                <span class="calendar-date">${Number(cell.key.slice(-2))}</span>
              </div>`;
        })}
      </div>
    </div>`;
  }

  private renderMeals() {
    return html`<section>
      <h2 class="section-title">Meals</h2>
      <form class="composer-card" @submit=${this.saveMeal}>
        <label class="field-label" for="meal-title">Title</label>
        <input class="text-input" id="meal-title" name="title" required />
        <label class="field-label" for="meal-description">Description</label>
        <textarea
          class="description-input"
          id="meal-description"
          name="description"
          rows="3"
        ></textarea>
        <label class="field-label" for="meal-calories">Calories</label>
        <input
          class="number-input"
          id="meal-calories"
          name="calories"
          type="number"
          min="0"
          required
        />
        <button class="save-button" type="submit">Save meal</button>
      </form>
      <ul class="meal-list">
        ${this.visibleMeals().map((meal) => {
          const key = `meal:${meal.id}`;
          return html`<li
            class="meal-card ${this.kebabKey === key ? "menu-open" : ""}"
          >
            <div class="meal-row">
              <div class="entry-copy">
                <p class="entry-calories">${titleCase(meal.title)}</p>
                <p class="entry-meta">
                  ${meal.description || "No description"} · ${meal.calories}
                  calories
                </p>
              </div>
              ${this.renderKebab(
                key,
                html`<button
                    class="popover-button"
                    role="menuitem"
                    @click=${() => this.openMeal(meal.id)}
                  >
                    Edit
                  </button>
                  <button
                    class="popover-button kebab-remove"
                    role="menuitem"
                    @click=${() => this.removeMeal(meal.id)}
                  >
                    Remove
                  </button>`,
              )}
            </div>
          </li>`;
        })}
      </ul>
    </section>`;
  }

  private renderMealEdit() {
    const meal = this.state.meals.find(
      (item) => item.id === this.selectedMealId,
    );
    if (!meal)
      return html`<p class="empty-note">That meal is no longer here.</p>`;
    return html`<section>
      <h2 class="section-title">Edit meal</h2>
      <form class="composer-card" @submit=${this.updateMeal}>
        <label class="field-label" for="edit-meal-title">Title</label>
        <input
          class="text-input"
          id="edit-meal-title"
          name="title"
          .value=${titleCase(meal.title)}
          required
        />
        <label class="field-label" for="edit-meal-description"
          >Description</label
        >
        <textarea
          class="description-input"
          id="edit-meal-description"
          name="description"
          rows="3"
          .value=${meal.description}
        ></textarea>
        <label class="field-label" for="edit-meal-calories">Calories</label>
        <input
          class="number-input"
          id="edit-meal-calories"
          name="calories"
          type="number"
          min="0"
          .value=${String(meal.calories)}
          required
        />
        <button class="save-button" type="submit">Save changes</button>
      </form>
    </section>`;
  }

  private heading(): string {
    if (this.page === "today") return "Today";
    if (this.page === "history") return "History";
    if (this.page === "day")
      return formatDayLabel(this.selectedDayKey, todayKey());
    if (this.page === "meals") return "Meals";
    if (this.page === "goal") return "Goal";
    return "Edit";
  }

  private renderGoal() {
    return html`<section>
      <h2 class="section-title">Daily goal</h2>
      <form class="goal-card" @submit=${this.saveGoal}>
        <label class="field-label" for="goal-calories"
          >Calories to stay near</label
        >
        <input
          class="number-input"
          id="goal-calories"
          name="calories"
          type="number"
          min="1"
          .value=${String(this.state.goal?.calories ?? 2000)}
        />
        <button class="save-button" type="submit">Save goal</button>
        <p class="tone-note">
          Color uses a seven-day window. Today counts fully, yesterday half, and
          each older day a little less. Under the goal pulls the color back
          toward green. 150 over the weighted window is yellow. 300 over is red.
        </p>
      </form>
    </section>`;
  }

  override render() {
    return html`<div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <a
            class="brand-mark"
            href="/"
            @click=${(event: Event) => {
              event.preventDefault();
              this.navigate("today");
            }}
            >Nourish</a
          >
          <h1 class="brand-name">${this.heading()}</h1>
        </div>
        <button
          class="menu-button"
          @click=${() => {
            this.kebabKey = "";
            this.closeEdit();
            this.menuOpen = true;
          }}
          aria-label="Open menu"
        >
          <span class="hamburger" aria-hidden="true"></span>
        </button>
      </header>
      <main class="app-main">
        ${
          this.offline
            ? html`<p class="offline-note" role="status">
                Offline. Your log stays on this device.
              </p>`
            : ""
        }
        ${this.page === "today" ? this.renderToday() : ""}
        ${this.page === "history" ? this.renderHistory() : ""}
        ${this.page === "day" ? this.renderDay() : ""}
        ${this.page === "meals" ? this.renderMeals() : ""}
        ${this.page === "meal" ? this.renderMealEdit() : ""}
        ${this.page === "goal" ? this.renderGoal() : ""}
      </main>
      ${
        this.menuOpen
          ? html`<div
              class="menu-sheet"
              @click=${() => (this.menuOpen = false)}
            >
              <nav
                class="menu-panel"
                @click=${(event: Event) => event.stopPropagation()}
              >
                <button
                  class="menu-link"
                  @click=${() => this.navigate("today")}
                >
                  Today
                </button>
                <button
                  class="menu-link"
                  @click=${() => this.navigate("history")}
                >
                  History
                </button>
                <button
                  class="menu-link"
                  @click=${() => this.navigate("meals")}
                >
                  Meals
                </button>
                <button class="menu-link" @click=${() => this.navigate("goal")}>
                  Set a goal
                </button>
              </nav>
            </div>`
          : ""
      }
      ${this.renderEdit()}
    </div>`;
  }
}
