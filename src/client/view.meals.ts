import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { shared } from "./style.js";
import {
  addEntry,
  getState,
  removeMeal,
  subscribe,
  upsertMeal,
} from "./util.store.js";

@customElement("nourish-meals")
export class NourishMeals extends LitElement {
  static override styles = [
    shared,
    css`
      :host {
        display: grid;
        gap: 14px;
      }
      form,
      .list {
        display: grid;
        gap: 10px;
      }
    `,
  ];
  @state() private mealTitle = "";
  @state() private description = "";
  @state() private calories = "";
  @state() private tick = 0;
  private unsubscribe?: () => void;
  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = subscribe(() => {
      this.tick += 1;
    });
  }
  override disconnectedCallback(): void {
    this.unsubscribe?.();
    super.disconnectedCallback();
  }

  private save(event: Event): void {
    event.preventDefault();
    const calories = Number(this.calories);
    if (!this.mealTitle.trim() || !Number.isInteger(calories) || calories < 0)
      return;
    upsertMeal({
      title: this.mealTitle.trim(),
      description: this.description.trim(),
      calories,
    });
    this.mealTitle = "";
    this.description = "";
    this.calories = "";
  }

  override render() {
    void this.tick;
    const meals = getState().meals;
    return html`
      <form class="card" @submit=${this.save}>
        <h2>Save a meal</h2>
        <input
          class="field"
          placeholder="Title"
          .value=${this.mealTitle}
          @input=${(e: Event) => {
            this.mealTitle = (e.target as HTMLInputElement).value;
          }}
        />
        <input
          class="field"
          placeholder="Notes"
          .value=${this.description}
          @input=${(e: Event) => {
            this.description = (e.target as HTMLInputElement).value;
          }}
        />
        <input
          class="field"
          inputmode="numeric"
          placeholder="Calories"
          .value=${this.calories}
          @input=${(e: Event) => {
            this.calories = (e.target as HTMLInputElement).value;
          }}
        />
        <button class="primary" type="submit">Save meal</button>
      </form>
      <section class="list">
        ${
          meals.length === 0
            ? html`<p class="muted">No saved meals yet.</p>`
            : meals.map(
                (meal) =>
                  html` <article class="card">
                    <div class="row">
                      <strong>${meal.title}</strong>
                      <span>${meal.calories.toLocaleString()} kcal</span>
                    </div>
                    ${meal.description ? html`<p class="muted">${meal.description}</p>` : ""}
                    <div class="row">
                      <button
                        class="primary"
                        @click=${() => addEntry(meal.calories, meal.id)}
                      >
                        Log today
                      </button>
                      <button
                        class="danger"
                        @click=${() => removeMeal(meal.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>`,
              )
        }
      </section>
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "nourish-meals": NourishMeals;
  }
}
