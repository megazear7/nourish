import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { CalorieEntry, Meal, NutritionState } from "../shared/type.nutrition.js";
import { addDays, dateKey, formatDayLabel, formatTime, timeValue, todayKey, withTime } from "../shared/util.dates.js";
import { toneColor, toneLabel, weightedOver, dayTotal } from "../shared/util.score.js";
import { loadState, saveState } from "./util.storage.js";
import { appStyles } from "./styles.global.js";

type PageName = "today" | "history" | "meals" | "goal";

@customElement("nourish-app")
export class NourishApp extends LitElement {
  static override styles = appStyles;

  @state() private state: NutritionState = loadState();
  @state() private page: PageName = "today";
  @state() private menuOpen = false;
  @state() private editingId = "";
  @state() private mealPickerOpen = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRoute();
    window.addEventListener("popstate", this.syncRoute);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }

  override disconnectedCallback(): void {
    window.removeEventListener("popstate", this.syncRoute);
    super.disconnectedCallback();
  }

  private syncRoute = (): void => {
    const path = window.location.pathname;
    if (path.startsWith("/history")) this.page = "history";
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
  }

  private commit(next: NutritionState): void {
    this.state = next;
    saveState(next);
  }

  private addCalories(calories: number, mealId?: string): void {
    const entry: CalorieEntry = {
      id: crypto.randomUUID(),
      calories,
      timestamp: new Date().toISOString(),
      mealId,
    };
    this.commit({ ...this.state, entries: [entry, ...this.state.entries] });
    this.mealPickerOpen = false;
  }

  private updateTime(entry: CalorieEntry, time: string): void {
    this.commit({
      ...this.state,
      entries: this.state.entries.map((item) =>
        item.id === entry.id ? { ...item, timestamp: withTime(item.timestamp, time) } : item,
      ),
    });
  }

  private removeEntry(id: string): void {
    this.commit({ ...this.state, entries: this.state.entries.filter((entry) => entry.id !== id) });
  }

  private saveMeal(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const meal: Meal = {
      id: crypto.randomUUID(),
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      calories: Number(data.get("calories") ?? 0),
    };
    if (!meal.title || !Number.isFinite(meal.calories)) return;
    this.commit({ ...this.state, meals: [meal, ...this.state.meals] });
    form.reset();
  }

  private saveGoal(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const calories = Number(new FormData(form).get("calories") ?? 0);
    if (!Number.isFinite(calories) || calories <= 0) return;
    this.commit({ ...this.state, goal: { calories } });
  }

  private todayEntries(): CalorieEntry[] {
    const today = todayKey();
    return this.state.entries
      .filter((entry) => dateKey(new Date(entry.timestamp)) === today)
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
        <p class="day-kicker">Today</p>
        <p class="calorie-total" style="color: ${color}">${total}</p>
        <p class="calorie-unit">calories</p>
        ${goal
          ? html`<p class="goal-note">Goal ${goal}</p><p class="tone-note">${toneLabel(weighted)}</p>`
          : html`<p class="goal-note">Set a daily goal to color the week.</p>`}
      </section>
      ${this.todayEntries().length
        ? html`<ul class="entry-list">
            ${this.todayEntries().map((entry) => this.renderEntry(entry))}
          </ul>`
        : html`<p class="empty-note">Nothing logged yet. Add a bite when you eat it.</p>`}
      <div class="action-dock">
        <button class="calorie-button" @click=${() => this.addCalories(100)}>+100</button>
        <button class="calorie-button" @click=${() => this.addCalories(200)}>+200</button>
        <button class="calorie-button" @click=${() => this.addCalories(500)}>+500</button>
        <button class="meal-button" @click=${() => (this.mealPickerOpen = true)}>Meals</button>
      </div>
      ${this.mealPickerOpen ? this.renderMealPicker() : ""}
    `;
  }

  private renderEntry(entry: CalorieEntry) {
    const meal = this.state.meals.find((item) => item.id === entry.mealId);
    return html`<li class="entry-card">
      <div class="entry-row">
        <div>
          <p class="entry-calories">+${entry.calories}</p>
          <p class="entry-meta">${meal?.title ?? "Quick add"} · ${formatTime(entry.timestamp)}</p>
        </div>
        <button class="text-button" @click=${() => (this.editingId = this.editingId === entry.id ? "" : entry.id)}>
          ${this.editingId === entry.id ? "Close" : "Time"}
        </button>
      </div>
      ${this.editingId === entry.id
        ? html`<div class="time-editor">
            <input
              class="time-input"
              type="time"
              .value=${timeValue(entry.timestamp)}
              @change=${(event: Event) => this.updateTime(entry, (event.target as HTMLInputElement).value)}
            />
            <button class="text-button" @click=${() => this.removeEntry(entry.id)}>Remove</button>
          </div>`
        : ""}
    </li>`;
  }

  private renderMealPicker() {
    return html`<div class="menu-sheet" @click=${() => (this.mealPickerOpen = false)}>
      <section class="menu-panel" @click=${(event: Event) => event.stopPropagation()}>
        <h2 class="section-title">Saved meals</h2>
        <ul class="meal-list">
          ${this.state.meals.map(
            (meal) => html`<li>
              <button class="menu-link" @click=${() => this.addCalories(meal.calories, meal.id)}>
                ${meal.title} · ${meal.calories}
              </button>
            </li>`,
          )}
        </ul>
        <button class="save-button" @click=${() => this.navigate("meals")}>Add a new meal</button>
      </section>
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
              ${goal ? html`<p class="tone-note">${toneLabel(weighted)}</p>` : ""}
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
        <textarea class="description-input" id="meal-description" name="description" rows="3"></textarea>
        <label class="field-label" for="meal-calories">Calories</label>
        <input class="number-input" id="meal-calories" name="calories" type="number" min="0" required />
        <button class="save-button" type="submit">Save meal</button>
      </form>
      <ul class="meal-list">
        ${this.state.meals.map(
          (meal) => html`<li class="meal-card">
            <div class="meal-row">
              <div>
                <p class="entry-calories">${meal.title}</p>
                <p class="entry-meta">${meal.description || "No description"} · ${meal.calories} calories</p>
              </div>
            </div>
          </li>`,
        )}
      </ul>
    </section>`;
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
          Color uses a seven-day window. Today counts fully, yesterday half, and each older day a little less. Under
          the goal pulls the color back toward green. 150 over the weighted window is yellow. 300 over is red.
        </p>
      </form>
    </section>`;
  }

  override render() {
    return html`<div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <span class="brand-mark">Nourish</span>
          <h1 class="brand-name">${this.page === "today" ? "Today" : this.page}</h1>
        </div>
        <button class="menu-button" @click=${() => (this.menuOpen = true)} aria-label="Open menu">Menu</button>
      </header>
      <main class="app-main">
        ${this.page === "today" ? this.renderToday() : ""}
        ${this.page === "history" ? this.renderHistory() : ""}
        ${this.page === "meals" ? this.renderMeals() : ""}
        ${this.page === "goal" ? this.renderGoal() : ""}
      </main>
      ${this.menuOpen
        ? html`<div class="menu-sheet" @click=${() => (this.menuOpen = false)}>
            <nav class="menu-panel" @click=${(event: Event) => event.stopPropagation()}>
              <button class="menu-link" @click=${() => this.navigate("today")}>Today</button>
              <button class="menu-link" @click=${() => this.navigate("history")}>Day by day</button>
              <button class="menu-link" @click=${() => this.navigate("meals")}>Add a meal</button>
              <button class="menu-link" @click=${() => this.navigate("goal")}>Set a goal</button>
            </nav>
          </div>`
        : ""}
    </div>`;
  }
}
