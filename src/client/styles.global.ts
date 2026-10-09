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

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at top, rgba(196, 154, 90, 0.16), transparent 42%),
      var(--canvas);
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
    text-decoration: none;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border-radius: 999px;
    background: var(--panel);
    color: var(--ink);
  }

  .hamburger {
    position: relative;
    width: 1.05rem;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }

  .hamburger::before,
  .hamburger::after {
    content: "";
    position: absolute;
    left: 0;
    width: 1.05rem;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }

  .hamburger::before {
    top: -6px;
  }

  .hamburger::after {
    top: 6px;
  }

  .app-main {
    flex: 1;
    min-width: 0;
    max-width: 100%;
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

  .day-status,
  .calorie-line {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    margin: 0;
  }

  .calorie-line {
    margin-top: 0.2rem;
  }

  .status-label {
    margin: 0;
    color: var(--muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.75rem;
  }

  .calorie-total {
    margin: 0;
    font-size: 4.4rem;
    line-height: 0.95;
    font-weight: 560;
  }

  .calorie-goal {
    color: var(--muted);
    font-size: 1rem;
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

  .goal-card .tone-note {
    margin-top: 1.25rem;
  }

  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
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

  .entry-card {
    padding: 0.15rem 0.35rem 0.15rem 0.9rem;
    border-radius: 0.95rem;
  }

  .day-card {
    padding: 0.7rem 0.9rem;
    border-radius: 0.95rem;
  }

  .day-card.day-link {
    padding: 0;
  }

  .day-button {
    appearance: none;
    display: block;
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 0;
    border-radius: inherit;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .entry-copy,
  .entry-line {
    min-width: 0;
  }

  .entry-line {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex: 1;
  }

  .log-amount {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .log-calories {
    font-size: 1.05rem;
    font-weight: 560;
  }

  button.log-calories {
    appearance: none;
    border: 0;
    background: none;
    margin: 0;
    padding: 0;
    color: inherit;
    font: inherit;
    font-size: 1.05rem;
    font-weight: 560;
    line-height: inherit;
    cursor: default;
    -webkit-tap-highlight-color: transparent;
  }

  button.log-calories:focus,
  button.log-calories:focus-visible {
    outline: none;
  }

  .log-unit {
    color: var(--muted);
    font-size: 0.95rem;
  }

  .log-time,
  .log-meal {
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.95rem;
    padding: 0.45rem 0;
    cursor: pointer;
    text-align: left;
  }

  .log-time {
    flex-shrink: 0;
  }

  .log-time-wrap {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }

  .clock-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }

  .log-meal {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-note {
    margin: 0 0.55rem 0.55rem 0;
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meal-description {
    margin: 1rem 0 0;
    color: var(--muted);
    line-height: 1.45;
  }

  .entry-calories,
  .day-calories {
    font-size: 1.25rem;
    font-weight: 560;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .icon-button svg {
    width: 1.2rem;
    height: 1.2rem;
  }

  .icon-button svg.dots {
    fill: currentColor;
    stroke: none;
  }

  .menu-open {
    position: relative;
    z-index: 8;
  }

  .kebab {
    position: relative;
    flex-shrink: 0;
  }

  .kebab-menu {
    position: absolute;
    top: calc(100% + 0.2rem);
    right: 0;
    z-index: 2;
    min-width: 11rem;
    padding: 0.3rem;
    border-radius: 0.95rem;
    background: #222433;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }

  .kebab-menu .popover-button {
    justify-content: flex-start;
    gap: 0.65rem;
  }

  .kebab-menu svg {
    width: 1.05rem;
    height: 1.05rem;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .kebab-menu .kebab-remove {
    color: #e7a29a;
  }

  .kebab-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1;
    background: transparent;
  }

  .text-input,
  .number-input,
  .description-input {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    border: 0;
    border-radius: 0.9rem;
    background: var(--field);
    color: var(--ink);
    font: inherit;
    padding: 0.85rem 0.95rem;
  }

  .description-input {
    resize: none;
  }

  .action-dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
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

  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 4;
    background: transparent;
  }

  .meal-bubbles {
    position: fixed;
    right: 1rem;
    bottom: 5.6rem;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    width: min(18rem, calc(100vw - 2rem));
    max-height: min(58vh, 26rem);
    overflow: auto;
    padding: 0.15rem 0.1rem 0.15rem 0;
  }

  .meal-bubble {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    max-width: 100%;
    min-height: 2.7rem;
    border: 0;
    border-radius: 999px;
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-weight: 560;
    text-align: left;
    padding: 0.55rem 0.95rem;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.38);
    cursor: pointer;
  }

  .meal-bubble-create {
    background: var(--field);
    color: var(--muted);
    font-weight: 500;
    box-shadow: none;
  }

  .meal-bubble-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meal-bubble-calories {
    flex-shrink: 0;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  .meal-bubble:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .popover-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 2.75rem;
    border: 0;
    border-radius: 0.75rem;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    padding: 0.7rem 0.8rem;
    cursor: pointer;
  }

  .popover-button + .popover-button {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
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

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0.2rem 0 1rem;
  }

  .section-heading .section-title {
    margin: 0;
  }

  .view-toggle {
    display: flex;
    flex-shrink: 0;
    padding: 0.18rem;
    border-radius: 999px;
    background: var(--field);
  }

  .view-toggle button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.82rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    cursor: pointer;
  }

  .view-toggle button[aria-pressed="true"] {
    background: var(--gold);
    color: #1b140c;
  }

  .calendar-card {
    background: var(--panel);
    border-radius: 1.25rem;
    padding: 0.7rem 0.45rem 0.55rem;
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0.2rem 0.45rem;
  }

  .calendar-month {
    margin: 0;
    font-size: 1.05rem;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.15rem;
  }

  .calendar-weekday {
    text-align: center;
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    padding-bottom: 0.25rem;
  }

  .calendar-day {
    min-height: 3.15rem;
    border-radius: 0.7rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.05rem;
  }

  button.calendar-day {
    appearance: none;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  button.calendar-day:focus-visible,
  .day-button:focus-visible {
    outline: 2px solid var(--accent, currentColor);
    outline-offset: 2px;
  }

  button.calendar-day.is-today {
    background: rgba(215, 176, 122, 0.14);
  }

  .calendar-day.outside {
    opacity: 0.4;
  }

  .calendar-day.is-today {
    background: rgba(215, 176, 122, 0.14);
  }

  .calendar-date {
    font-size: 0.78rem;
  }

  .calendar-calories {
    font-size: 0.68rem;
    font-weight: 560;
    font-variant-numeric: tabular-nums;
  }

  .icon-button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .icon-button svg.chevron {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
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

  .edit-sheet {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(6, 7, 12, 0.62);
  }

  .edit-modal {
    width: min(24rem, 100%);
    max-height: min(90vh, 40rem);
    overflow: auto;
    background: var(--panel);
    border-radius: 1.25rem;
    padding: 1.15rem 1.15rem 1.2rem;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
  }

  .edit-heading {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 560;
  }

  .edit-modal .field-label:first-of-type {
    margin-top: 0.85rem;
  }

  .edit-calories {
    font-size: 1.7rem;
    font-weight: 560;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .calorie-nudge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .nudge-side {
    display: flex;
    gap: 0.4rem;
  }

  .nudge-button,
  .check-button {
    border: 0;
    cursor: pointer;
    font: inherit;
  }

  .nudge-button {
    min-width: 3.35rem;
    min-height: 2.7rem;
    padding: 0 0.55rem;
    border-radius: 0.85rem;
    background: var(--field);
    color: var(--ink);
    font-weight: 620;
  }

  .nudge-button.nudge-plus {
    background: var(--gold);
    color: #1b140c;
  }

  .check-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.3rem;
    height: 3.3rem;
    margin: 1.05rem auto 0;
    border-radius: 999px;
    background: var(--gold);
    color: #1b140c;
  }

  .check-button svg {
    width: 1.4rem;
    height: 1.4rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .nudge-button:focus-visible,
  .check-button:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
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

  .meal-list {
    margin-top: 0.35rem;
  }

  button.meal-create {
    appearance: none;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 4.6rem;
    padding: 1rem 1rem 0.9rem;
    border-radius: 1.25rem;
    border: 1.5px dotted rgba(215, 176, 122, 0.85);
    background: transparent;
    color: var(--gold);
    font: inherit;
    font-size: 1.25rem;
    font-weight: 560;
    text-align: left;
    cursor: pointer;
  }

  button.meal-create:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
  }
`;
