import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { latestGoal } from "../shared/fold.js";
import { shared } from "./style.js";
import { getState, setGoal, subscribe } from "./util.store.js";

@customElement("nourish-goal")
export class NourishGoal extends LitElement {
  static override styles = [
    shared,
    css`
      :host,
      form {
        display: grid;
        gap: 12px;
      }
    `,
  ];
  @state() private calories = String(
    latestGoal(getState().goals)?.calories ?? 2000,
  );
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
    const value = Number(this.calories);
    if (!Number.isInteger(value) || value <= 0) return;
    setGoal(value);
  }

  override render() {
    void this.tick;
    const current = latestGoal(getState().goals)?.calories;
    return html`
      <form class="card" @submit=${this.save}>
        <h2>Daily goal</h2>
        <p class="muted">
          ${current ? `Current goal is ${current.toLocaleString()} kcal.` : "No goal set yet."}
        </p>
        <input
          class="field"
          inputmode="numeric"
          .value=${this.calories}
          @input=${(e: Event) => {
            this.calories = (e.target as HTMLInputElement).value;
          }}
        />
        <button class="primary" type="submit">Save goal</button>
      </form>
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "nourish-goal": NourishGoal;
  }
}
