import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./view.home.js";
import "./view.history.js";
import "./view.meals.js";
import "./view.goal.js";

type Tab = "today" | "meals" | "history" | "goal";

@customElement("nourish-app")
export class NourishApp extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: radial-gradient(1200px 500px at 10% -10%, rgba(94,107,255,0.25), transparent 50%), #070911;
      color: #e8eaf6;
      font-family: Inter, system-ui, sans-serif;
    }
    main { max-width: 520px; margin: 0 auto; padding: 28px 18px 96px; display: grid; gap: 8px; }
    header p { margin: 4px 0 0; color: #9aa3c7; }
    h1 { margin: 0; font-size: 1.4rem; letter-spacing: -0.03em; }
    nav {
      position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%);
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
      width: min(520px, calc(100% - 24px));
      background: rgba(12,13,24,0.9); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 8px; backdrop-filter: blur(16px);
    }
    button { border: 0; background: transparent; color: #9aa3c7; border-radius: 12px; padding: 10px 4px; font: inherit; font-weight: 600; }
    button[aria-current="page"] { background: rgba(94,107,255,0.2); color: #fff; }
  `;

  @state() private tab: Tab = "today";

  override firstUpdated(): void {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }

  override render() {
    return html`
      <main>
        <header>
          <h1>Nourish</h1>
          <p>A quiet calorie log. Everything stays on this device.</p>
        </header>
        ${this.tab === "today" ? html`<nourish-home></nourish-home>` : ""}
        ${this.tab === "meals" ? html`<nourish-meals></nourish-meals>` : ""}
        ${this.tab === "history" ? html`<nourish-history></nourish-history>` : ""}
        ${this.tab === "goal" ? html`<nourish-goal></nourish-goal>` : ""}
      </main>
      <nav>
        ${
          (["today", "meals", "history", "goal"] as const).map(
            (tab) => html`
              <button aria-current=${this.tab === tab ? "page" : "false"} @click=${() => { this.tab = tab; }}>${tab}</button>
            `,
          )
        }
      </nav>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { "nourish-app": NourishApp; } }
