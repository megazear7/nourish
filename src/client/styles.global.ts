import { css } from "lit";

export const appStyles = css`
  :host {
    --canvas: #0c0d18;
    --panel: #171924;
    --field: #10121b;
    --ink: #f4efe6;
    --muted: #a9a297;
    --gold: #d7b07a;
    display: block;
    min-height: 100vh;
    color: var(--ink);
    font-family: Inter, "Segoe UI", sans-serif;
    background: var(--canvas);
  }

  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at top, rgba(196, 154, 90, 0.16), transparent 42%), var(--canvas);
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.25rem 0.5rem;
  }

  .brand {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .brand-mark {
    font-size: 0.75rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--gold);
  }

  .brand-name {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 560;
  }

  .menu-button,
  .text-button,
  .calorie-button,
  .meal-button,
  .save-button {
    border: 0;
    cursor: pointer;
    font: inherit;
  }

  .menu-button {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    background: var(--panel);
    color: var(--ink);
  }

  .app-main {
    flex: 1;
    padding: 0.5rem 1.25rem 7.5rem;
  }

  .offline-note {
    margin: 0.15rem 0 0;
    color: var(--gold);
    font-size: 0.85rem;
  }

  .day-summary {
    padding: 1.5rem 0 1rem;
  }

  .day-kicker {
    margin: 0;
    color: var(--muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.75rem;
  }

  .calorie-total {
    margin: 0.35rem 0 0;
    font-size: 4.4rem;
    line-height: 0.95;
    font-weight: 560;
  }

  .calorie-unit,
  .goal-note,
  .tone-note,
  .empty-note,
  .entry-meta {
    color: var(--muted);
  }

  .tone-note {
    margin: 0.4rem 0 0;
  }

  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 1.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .entry-card,
  .day-card,
  .meal-card,
  .goal-card,
  .composer-card {
    background: var(--panel);
    border-radius: 1.25rem;
    padding: 1rem 1rem 0.9rem;
  }

  .entry-row,
  .day-row,
  .meal-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .entry-calories,
  .day-calories {
    font-size: 1.25rem;
    font-weight: 560;
  }

  .time-editor {
    margin-top: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .time-input,
  .text-input,
  .number-input,
  .description-input {
    width: 100%;
    border: 0;
    border-radius: 0.9rem;
    background: var(--field);
    color: var(--ink);
    font: inherit;
    padding: 0.85rem 0.95rem;
  }

  .action-dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.55rem;
    padding: 0.85rem 1rem 1.15rem;
    background: linear-gradient(to top, var(--canvas) 70%, transparent);
  }

  .calorie-button,
  .meal-button {
    min-height: 3.4rem;
    border-radius: 1.1rem;
    background: var(--gold);
    color: #1b140c;
    font-weight: 620;
  }

  .meal-button {
    background: var(--panel);
    color: var(--ink);
  }

  .menu-sheet {
    position: fixed;
    inset: 0;
    background: rgba(6, 7, 12, 0.55);
  }

  .menu-panel {
    position: absolute;
    top: 0;
    right: 0;
    width: min(22rem, 88vw);
    height: 100%;
    background: var(--panel);
    padding: 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .menu-link {
    text-align: left;
    background: transparent;
    color: var(--ink);
    border: 0;
    font: inherit;
    font-size: 1.15rem;
    padding: 0.85rem 0.2rem;
    cursor: pointer;
  }

  .section-title {
    margin: 0.2rem 0 1rem;
    font-size: 1.8rem;
  }

  .field-label {
    display: block;
    margin: 0.85rem 0 0.35rem;
    color: var(--muted);
  }

  .save-button,
  .text-button {
    margin-top: 1rem;
    border-radius: 999px;
    padding: 0.8rem 1rem;
    background: var(--gold);
    color: #1b140c;
  }

  .text-button {
    background: transparent;
    color: var(--muted);
  }

  .day-list,
  .meal-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
`;
