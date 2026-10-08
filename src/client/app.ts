import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { CalorieEntry, Meal, NutritionState } from "../shared/type.nutrition.js";
import {
  addDays,
  dateKey,
  formatDayLabel,
  formatTime,
  timeValue,
  todayKey,
  withTime,
} from "../shared/util.dates.js";
import { toneColor, toneLabel, weightedOver, dayTotal } from "../shared/util.score.js";
import { loadState, saveState } from "./util.storage.js";
import { appStyles } from "./styles.global.js";

type PageName = "today" | "history" | "meals" | "goal" | "meal";

const QUICK_WINDOW_MS = 60_000;

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
  const ordered = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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
  @state() private menuOpen = false;
  @state() private editingId = "";
  @state() private mealPickerOpen = false;
  @state() private kebabKey = "";
  @state() private offline = !navigator.onLine;

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
    if (document.visibilityState !== "visible" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
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
    const path = window.location.pathname;
    const meal = path.match(/^\/meal\/([^/]+)\/?$/);
    if (meal) {
      this.page = "meal";
      this.selectedMealId = decodeURIComponent(meal[1] ?? "");
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
    this.editingId = "";
  }

  private openMeal(id: string): void {
    window.history.pushState({}, "", `/meal/${encodeURIComponent(id)}`);
    this.page = "meal";
    this.selectedMealId = id;
    this.menuOpen = false;
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.editingId = "";
  }

  private commit(next: NutritionState): void {
    this.state = next;
    saveState(next);
  }

  private addCalories(calories: number, mealId?: string): void {
    const meal = mealId ? this.state.meals.find((item) => item.id === mealId) : undefined;
    const entry: CalorieEntry = {
      id: crypto.randomUUID(),
      calories,
      timestamp: new Date().toISOString(),
      mealId,
      mealTitle: meal?.title,
    };
    this.commit({ ...this.state, entries: [entry, ...this.state.entries] });
    this.mealPickerOpen = false;
  }

  private updateShownTime(shown: ShownEntry, time: string): void {
    const ids = new Set(shown.entries.map((entry) => entry.id));
    this.commit({
      ...this.state,
      entries: this.state.entries.map((item) =>
        ids.has(item.id) ? { ...item, timestamp: withTime(item.timestamp, time) } : item,
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
    if (this.editingId === shown.key) this.editingId = "";
    this.kebabKey = "";
  }

  private removeMeal(id: string): void {
    this.commit({
      ...this.state,
      meals: this.state.meals.map((meal) => (meal.id === id ? { ...meal, removed: true } : meal)),
    });
    this.kebabKey = "";
  }

  private toggleKebab(key: string): void {
    this.mealPickerOpen = false;
    this.menuOpen = false;
    this.kebabKey = this.kebabKey === key ? "" : key;
  }

  private editTime(shown: ShownEntry): void {
    this.editingId = shown.key;
    this.kebabKey = "";
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
        meal.id === this.selectedMealId ? { ...meal, title, description, calories } : meal,
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
      .filter((entry) => !entry.removed && dateKey(new Date(entry.timestamp)) === today)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
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
          : html`<p class="empty-note">Nothing logged yet. Add a bite when you eat it.</p>`
      }
      <div class="action-dock">
        <button class="calorie-button" @click=${() => this.addCalories(50)}>+50</button>
        <button class="calorie-button" @click=${() => this.addCalories(100)}>+100</button>
        <button class="calorie-button" @click=${() => this.addCalories(500)}>+500</button>
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
          ? html`<div class="kebab-backdrop" @click=${() => (this.kebabKey = "")}></div>
              <div class="kebab-menu" role="menu">${items}</div>`
          : ""
      }
    </div>`;
  }

  private renderEntry(shown: ShownEntry) {
    const meal = this.state.meals.find((item) => item.id === shown.mealId);
    const title = shown.entries.find((entry) => entry.mealTitle)?.mealTitle ?? meal?.title;
    const open = this.editingId === shown.key;
    return html`<li class="entry-card ${this.kebabKey === shown.key ? "menu-open" : ""}">
      <div class="entry-row">
        <div class="entry-line">
          <span class="log-amount">
            <span class="log-calories">${shown.calories}</span>
            <span class="log-unit">calories</span>
          </span>
          <button class="log-time" type="button" @click=${() => this.editTime(shown)}>
            ${formatTime(shown.timestamp)}
          </button>
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
          html`<button class="popover-button" role="menuitem" @click=${() => this.editTime(shown)}>
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
              Remove
            </button>`,
        )}
      </div>
      ${
        open
          ? html`<div class="time-editor">
              <input
                class="time-input"
                type="time"
                .value=${timeValue(shown.timestamp)}
                @change=${(event: Event) =>
                  this.updateShownTime(shown, (event.target as HTMLInputElement).value)}
              />
            </div>`
          : ""
      }
    </li>`;
  }

  private renderMealPicker() {
    const meals = this.visibleMeals();
    return html`<div class="popover-backdrop" @click=${() => (this.mealPickerOpen = false)}></div>
      <div class="meal-popover" role="menu" @click=${(event: Event) => event.stopPropagation()}>
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

  private renderHistory() {
    const today = todayKey();
    const days = Array.from({ length: 30 }, (_, index) => addDays(today, -index));
    const goal = this.state.goal?.calories;
    return html`<section>
      <h2 class="section-title">Days</h2>
      <ul class="day-list">
        ${days.map((day) => {
          const total = dayTotal(this.state.entries, day);
          const weighted = goal ? weightedOver(this.state.entries, day, goal) : 0;
          const color = goal ? toneColor(weighted) : "var(--ink)";
          return html`<li class="day-card">
            <div class="day-row">
              <div>
                <p class="day-kicker">${formatDayLabel(day, today)}</p>
                <p class="day-calories" style="color: ${color}">${total}</p>
              </div>
            </div>
          </li>`;
        })}
      </ul>
    </section>`;
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
          return html`<li class="meal-card ${this.kebabKey === key ? "menu-open" : ""}">
            <div class="meal-row">
              <div class="entry-copy">
                <p class="entry-calories">${titleCase(meal.title)}</p>
                <p class="entry-meta">
                  ${meal.description || "No description"} · ${meal.calories} calories
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
    const meal = this.state.meals.find((item) => item.id === this.selectedMealId);
    if (!meal) return html`<p class="empty-note">That meal is no longer here.</p>`;
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
        <label class="field-label" for="edit-meal-description">Description</label>
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
    if (this.page === "meals") return "Meals";
    if (this.page === "goal") return "Goal";
    return "Edit";
  }

  private renderGoal() {
    return html`<section>
      <h2 class="section-title">Daily goal</h2>
      <form class="goal-card" @submit=${this.saveGoal}>
        <label class="field-label" for="goal-calories">Calories to stay near</label>
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
          Color uses a seven-day window. Today counts fully, yesterday half, and each older day a
          little less. Under the goal pulls the color back toward green. 150 over the weighted
          window is yellow. 300 over is red.
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
        ${this.page === "meals" ? this.renderMeals() : ""}
        ${this.page === "meal" ? this.renderMealEdit() : ""}
        ${this.page === "goal" ? this.renderGoal() : ""}
      </main>
      ${
        this.menuOpen
          ? html`<div class="menu-sheet" @click=${() => (this.menuOpen = false)}>
              <nav class="menu-panel" @click=${(event: Event) => event.stopPropagation()}>
                <button class="menu-link" @click=${() => this.navigate("today")}>Today</button>
                <button class="menu-link" @click=${() => this.navigate("history")}>
                  Day by day
                </button>
                <button class="menu-link" @click=${() => this.navigate("meals")}>Add a meal</button>
                <button class="menu-link" @click=${() => this.navigate("goal")}>Set a goal</button>
              </nav>
            </div>`
          : ""
      }
    </div>`;
  }
}
