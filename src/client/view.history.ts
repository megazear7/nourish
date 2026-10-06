import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { shared } from "./style.js";
import { caloriesOn, getState, subscribe } from "./util.store.js";
import { dateKey } from "./util.storage.js";

@customElement("nourish-history")
export class NourishHistory extends LitElement {
  static override styles = [shared, css`:host { display: grid; gap: 8px; }`];
  @state() private tick = 0;
  private unsubscribe?: () => void;
  override connectedCallback(): void { super.connectedCallback(); this.unsubscribe = subscribe(() => { this.tick += 1; }); }
  override disconnectedCallback(): void { this.unsubscribe?.(); super.disconnectedCallback(); }

  override render() {
    void this.tick;
    const goal = getState().goal?.calories;
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      const key = dateKey(date);
      return { key, label: date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }), total: caloriesOn(key) };
    });
    return html`${days.map((day) => html`
      <article class="card row">
        <div>
          <strong>${day.label}</strong>
          <p class="muted">${goal ? `${Math.round((day.total / goal) * 100)}% of goal` : "No goal set"}</p>
        </div>
        <strong>${day.total.toLocaleString()}</strong>
      </article>`)}`;
  }
}
declare global { interface HTMLElementTagNameMap { "nourish-history": NourishHistory; } }
