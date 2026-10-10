import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { latestGoal } from "../shared/fold.js";
import { shared } from "./style.js";
import {
  addEntry,
  entriesOn,
  getState,
  removeEntry,
  subscribe,
  todayCalories,
} from "./util.store.js";
import { todayKey } from "./util.storage.js";

@customElement("nourish-home")
export class NourishHome extends LitElement {
  static override styles = [
    shared,
    css`
      :host {
        display: grid;
        gap: 14px;
      }
      .bar {
        height: 8px;
        border-radius: 99px;
        background: rgba(255, 255, 255, 0.08);
        margin-top: 12px;
        overflow: hidden;
      }
      .bar span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #5e6bff, #52d7d8);
      }
      form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }
      .list {
        display: grid;
        gap: 8px;
      }
    `,
  ];

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

  private submit(event: Event): void {
    event.preventDefault();
    const value = Number(this.calories);
    if (!Number.isInteger(value) || value <= 0) return;
    addEntry(value);
    this.calories = "";
  }

  override render() {
    void this.tick;
    const goal = latestGoal(getState().goals)?.calories;
    const total = todayCalories();
    const ratio = goal ? Math.min(total / goal, 1) : 0;
    const entries = entriesOn(todayKey());
    return html`
      <section class="card">
        <p class="muted">Today</p>
        <h1>${total.toLocaleString()} kcal</h1>
        <p class="muted">
          ${goal ? `of ${goal.toLocaleString()} · ${Math.round(ratio * 100)}%` : "Set a daily goal to track progress"}
        </p>
        <div class="bar">
          <span style="width:${goal ? ratio * 100 : 0}%"></span>
        </div>
      </section>
      <form @submit=${this.submit}>
        <input
          class="field"
          inputmode="numeric"
          placeholder="Add calories"
          .value=${this.calories}
          @input=${(e: Event) => {
            this.calories = (e.target as HTMLInputElement).value;
          }}
        />
        <button class="primary" type="submit">Log</button>
      </form>
      <section class="list">
        ${
          entries.length === 0
            ? html`<p class="muted">Nothing logged yet.</p>`
            : entries.map(
                (entry) =>
                  html` <article class="card row">
                    <div>
                      <strong>${entry.calories.toLocaleString()} kcal</strong>
                      <p class="muted">
                        ${new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      class="danger"
                      @click=${() => removeEntry(entry.id)}
                    >
                      Remove
                    </button>
                  </article>`,
              )
        }
      </section>
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "nourish-home": NourishHome;
  }
}
