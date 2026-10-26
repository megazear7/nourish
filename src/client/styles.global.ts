import { css } from "lit";

export const appStyles = css`
  :host {
    --canvas: #0c0d18;
    --panel: #171924;
    --field: #10121b;
    --ink: #f4efe6;
    --muted: #a9a297;
    --gold: #d7b07a;
    --content: 45rem;
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
    position: relative;
    display: block;
  }

  .header-main {
    width: min(100%, var(--content));
    margin-inline: auto;
    padding: 1.25rem 1.25rem 0.5rem;
  }

  @media (max-width: 54rem) {
    .header-main {
      padding-right: 4.75rem;
    }
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
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    bottom: 0.5rem;
    margin-block: auto;
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
    overflow: hidden;
  }

  .profile-icon {
    width: 1.35rem;
    height: 1.35rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
  }

  .avatar {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    object-fit: cover;
    background: var(--field);
    color: var(--gold);
    font-size: 0.85rem;
    font-weight: 650;
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
    width: min(100%, var(--content));
    margin-inline: auto;
    padding: 0.5rem 1.25rem 7.5rem;
  }

  .app-main:has(.remaining-note) {
    padding-bottom: 9.25rem;
  }

  .offline-note {
    margin: 0.15rem 0 0;
    color: var(--gold);
    font-size: 0.85rem;
  }

  .sync-reauth {
    border: 0;
    padding: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 0.15em;
    cursor: pointer;
  }

  .sync-reauth:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
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

  .aim-note {
    display: block;
    width: fit-content;
    max-width: 100%;
    border: 0;
    padding: 0;
    margin: 0.35rem 0 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.95rem;
    line-height: 1.35;
    text-align: left;
    cursor: pointer;
  }

  .aim-note:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .goal-link {
    border: 0;
    padding: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .goal-link:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .fast-link {
    border: 0;
    padding: 0;
    margin: 0.25rem 0 0;
    background: none;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }

  .fast-link:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .fast-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
  }

  .fast-switch {
    position: relative;
    flex: none;
    width: 3rem;
    height: 1.75rem;
    border: 1px solid var(--muted);
    border-radius: 999px;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }

  .fast-switch::after {
    content: "";
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: var(--muted);
    transition: transform 0.15s;
  }

  .fast-switch[aria-checked="true"] {
    border-color: var(--gold);
  }

  .fast-switch[aria-checked="true"]::after {
    background: var(--gold);
    transform: translateX(1.2rem);
  }

  .fast-switch:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
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
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .entry-title-row {
    display: none;
  }

  @media (max-width: 720px) {
    .log-meal-inline {
      display: none;
    }

    .entry-note {
      display: none;
    }

    button.entry-title-row,
    span.entry-title-row {
      display: block;
      width: calc(100% - 0.55rem);
      margin: 0 0.55rem 0.5rem 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.95rem;
      line-height: 1.35;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    button.entry-title-row {
      cursor: pointer;
    }
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
    left: 50%;
    bottom: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: min(100%, var(--content));
    padding: 0.85rem 1rem 1.15rem;
    background: linear-gradient(to top, var(--canvas) 70%, transparent);
    transform: translateX(-50%);
  }

  .action-dock:has(.remaining-note) {
    background: linear-gradient(to top, var(--canvas) 88%, transparent);
  }

  .remaining-note {
    margin: -12px 0 0;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.35;
    text-align: left;
  }

  .dock-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.55rem;
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
    right: max(1rem, calc((100% - var(--content)) / 2 + 1rem));
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

  .action-dock:has(.remaining-note) ~ .meal-bubbles {
    bottom: 7.4rem;
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
    z-index: 12;
    background: transparent;
  }

  .menu-sheet::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(6, 7, 12, 0.55);
    opacity: 0;
    transition: opacity 240ms ease;
  }

  .menu-sheet.is-open::before {
    opacity: 1;
  }

  .menu-panel {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    width: min(22rem, 88vw);
    height: 100%;
    background: var(--panel);
    padding: 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    transform: translateX(100%);
    transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .menu-sheet.is-open .menu-panel {
    transform: translateX(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .menu-sheet::before,
    .menu-panel {
      transition: none;
    }
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

  .menu-sign-out {
    margin-top: auto;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-weight: 560;
    padding: 0.75rem 0.9rem;
    cursor: pointer;
  }

  .account-block {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding-bottom: 0.9rem;
    margin-bottom: 0.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .account-name {
    margin: 0;
    font-size: 1.05rem;
  }

  .account-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .account-link .account-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-link svg.chevron {
    width: 1.15rem;
    height: 1.15rem;
    flex-shrink: 0;
    fill: none;
    color: var(--muted);
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .account-link:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .profile-photo {
    width: 5.5rem;
    height: 5.5rem;
    margin: 0.15rem auto 0.85rem;
    border-radius: 999px;
    overflow: hidden;
    background: var(--field);
  }

  .profile-photo .avatar {
    font-size: 1.35rem;
  }

  .profile-email {
    margin: 0;
    color: var(--muted);
    text-align: center;
    word-break: break-all;
  }

  .profile-card .field-label {
    max-width: 400px;
    margin: 1.1rem auto 0.35rem;
    text-align: center;
  }

  .profile-name {
    max-width: 400px;
    margin-right: auto;
    margin-left: auto;
  }

  .profile-card .check-button {
    position: relative;
    transition:
      transform 140ms cubic-bezier(0.22, 1, 0.36, 1),
      background 320ms cubic-bezier(0.22, 1, 0.36, 1),
      color 320ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .profile-card .check-button:active {
    transform: scale(0.92);
  }

  .profile-card .check-button.is-saved {
    background: rgb(111, 191, 132);
    color: #102116;
    animation: check-pop 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .profile-card .check-button.is-saved::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 2px solid rgb(111, 191, 132);
    pointer-events: none;
    animation: check-ring 640ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .profile-card .check-button svg path {
    stroke-dasharray: 24;
    stroke-dashoffset: 0;
  }

  .profile-card .check-button.is-saved svg path {
    animation: check-draw 360ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes check-pop {
    0% {
      transform: scale(0.92);
    }
    55% {
      transform: scale(1.08);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes check-ring {
    0% {
      transform: scale(1);
      opacity: 0.9;
    }
    100% {
      transform: scale(1.65);
      opacity: 0;
    }
  }

  @keyframes check-draw {
    from {
      stroke-dashoffset: 24;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .profile-card .check-button,
    .profile-card .check-button.is-saved,
    .profile-card .check-button.is-saved::after,
    .profile-card .check-button svg path,
    .profile-card .check-button.is-saved svg path {
      animation: none;
      transition: none;
    }

    .profile-card .check-button:active {
      transform: none;
    }
  }

  .account-copy {
    margin: 0;
    color: var(--muted);
    line-height: 1.4;
  }

  .account-actions {
    display: flex;
    gap: 0.5rem;
  }

  .account-button {
    border: 0;
    border-radius: 999px;
    background: var(--gold);
    color: #1a140c;
    font: inherit;
    font-weight: 650;
    padding: 0.65rem 0.9rem;
    cursor: pointer;
  }

  .account-secondary {
    background: transparent;
    color: var(--ink);
    border: 1px solid rgba(255, 255, 255, 0.16);
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
    flex: 1;
    gap: 0.35rem;
    min-width: 0;
  }

  .nudge-button,
  .check-button {
    border: 0;
    cursor: pointer;
    font: inherit;
  }

  .nudge-button {
    flex: 1;
    min-width: 0;
    min-height: 2.7rem;
    padding: 0 0.2rem;
    border-radius: 0.85rem;
    background: var(--field);
    color: var(--ink);
    font-size: 0.95rem;
    font-weight: 620;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
    gap: 0;
    margin-top: 0;
  }

  .meal-card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .meal-card.is-dragging {
    opacity: 0.55;
  }

  .meal-drag {
    cursor: grab;
    touch-action: none;
  }

  .meal-card.is-dragging .meal-drag {
    cursor: grabbing;
  }

  .meal-list.is-dragging .meal-card {
    touch-action: none;
  }

  .meal-top,
  .meal-bottom {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .meal-bottom {
    justify-content: flex-end;
  }

  .meal-card .entry-calories,
  .meal-card .entry-meta {
    margin: 0;
  }

  .meal-top .entry-calories {
    min-width: 0;
  }

  .meal-gap {
    height: 0.75rem;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .drop-line {
    display: block;
    width: 100%;
    height: 2px;
    border-radius: 999px;
    background: transparent;
  }

  .drop-line.is-on {
    background: var(--gold);
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

  .competition-page {
    padding-bottom: 5rem;
  }

  .competition-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  button.competition-row,
  .member-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--panel);
    color: inherit;
    border: 0;
    border-radius: 1.25rem;
    padding: 1rem 1rem 0.9rem;
    font: inherit;
  }

  button.competition-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.45rem;
    cursor: pointer;
  }

  button.competition-row:focus-visible,
  button.kind-choice:focus-visible,
  button.competition-add:focus-visible,
  .chip-remove:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
  }

  .competition-kind {
    display: block;
    margin: 0;
    font-size: 1.05rem;
    font-weight: 620;
  }

  .competition-meta,
  .member-card .entry-meta,
  .member-card .entry-calories {
    margin: 0.2rem 0 0;
  }

  .competition-phase {
    margin: 0 0 0.85rem;
  }

  .competition-phase:has(+ .days-remaining) {
    margin-bottom: 0.2rem;
  }

  .days-remaining {
    margin: 0 0 0.85rem;
    color: var(--ink);
    font-size: 1.15rem;
    font-weight: 620;
  }

  .member-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .member-top .entry-calories {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .member-remove {
    margin: 0;
    padding: 0.15rem 0;
    min-height: 0;
    flex: none;
  }

  .member-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.85rem;
    margin-top: 0.45rem;
  }

  .member-status .entry-meta {
    margin: 0;
  }

  .suggest {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .suggest-field {
    position: relative;
  }

  .suggest-field .text-input {
    padding-right: 2.6rem;
  }

  .suggest-toggle {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.6rem;
    height: 100%;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .suggest-toggle svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .suggest-toggle[aria-expanded="true"] svg {
    transform: rotate(180deg);
  }

  .suggest-backdrop {
    position: fixed;
    inset: 0;
    z-index: 5;
    border: 0;
    padding: 0;
    background: transparent;
  }

  .suggest-menu {
    position: absolute;
    z-index: 6;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    max-height: 14rem;
    margin: 0;
    padding: 0.3rem;
    overflow: auto;
    list-style: none;
    background: var(--panel);
    border-radius: 0.9rem;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);
  }

  .suggest-menu button {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 0.65rem;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    padding: 0.7rem 0.75rem;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .suggest-menu button:focus-visible,
  .suggest-toggle:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .kind-choices {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  button.kind-choice {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 3.25rem;
    text-align: left;
    background: var(--field);
    color: inherit;
    border: 1px solid transparent;
    border-radius: 1rem;
    padding: 0.85rem 0.9rem;
    font: inherit;
    cursor: pointer;
  }

  button.kind-choice.is-on {
    border-color: var(--gold);
    background: rgba(215, 176, 122, 0.14);
  }

  .email-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .email-row .text-input {
    flex: 1;
    min-width: 0;
  }

  .email-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.85rem 0 0;
    padding: 0;
    list-style: none;
  }

  .email-chip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
    background: var(--field);
    border-radius: 999px;
    padding: 0.3rem 0.35rem 0.3rem 0.75rem;
  }

  .email-chip span {
    overflow-wrap: anywhere;
  }

  .chip-remove {
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }

  .competition-actions,
  .competition-start,
  .competition-invite,
  .competition-copy {
    margin-top: 1rem;
  }

  .competition-actions {
    flex-direction: column;
  }

  .competition-actions .account-button,
  .competition-start,
  .competition-copy {
    width: 100%;
    min-height: 2.85rem;
  }

  .competition-copy {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .email-row .account-button {
    flex: none;
    min-height: 2.85rem;
  }

  .call-on-track {
    color: rgb(111, 191, 132);
  }

  .call-drifting {
    color: rgb(168, 188, 103);
  }

  .call-running-hot {
    color: rgb(224, 184, 74);
  }

  .call-over {
    color: rgb(214, 84, 78);
  }

  .call-miss {
    color: var(--muted);
  }

  button.competition-add {
    position: fixed;
    right: max(1rem, calc((100% - var(--content)) / 2 + 1rem));
    bottom: 1.25rem;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.25rem;
    height: 3.25rem;
    border: 0;
    border-radius: 999px;
    background: var(--gold);
    color: #1b140c;
    cursor: pointer;
  }

  button.competition-add svg {
    width: 1.35rem;
    height: 1.35rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .back-competitions {
    position: fixed;
    left: max(1.25rem, calc((100% - var(--content)) / 2 + 1.25rem));
    bottom: 1.25rem;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    padding: 0.35rem 0;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .back-competitions:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
  }

  .back-competitions svg {
    width: 1.05rem;
    height: 1.05rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .row-top,
  .board-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    min-width: 0;
  }

  .row-top .competition-kind {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .phase-pill {
    flex: none;
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .phase-pill.phase-active {
    color: var(--gold);
  }

  .calorie-pips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.85rem;
  }

  .calorie-pip {
    font-variant-numeric: tabular-nums;
    font-weight: 620;
    font-size: 1.05rem;
  }

  .calorie-pip.is-you {
    font-size: 1.35rem;
  }

  .knocked-line {
    margin: 0.35rem 0 0;
    color: rgb(224, 184, 74);
    font-size: 0.95rem;
    font-weight: 620;
    white-space: normal;
  }

  .board-page {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .board-result {
    margin: 0 0 0.85rem;
    font-size: clamp(1.45rem, 6vw, 1.85rem);
    font-weight: 620;
    letter-spacing: -0.03em;
  }

  .life-rail {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin: 0 0 0.85rem;
  }

  .life-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .life-dot {
    flex: none;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
    background: rgb(111, 191, 132);
    box-shadow: 0 0 0 4px rgba(111, 191, 132, 0.16);
  }

  .life-dot.is-out {
    background: rgb(224, 184, 74);
    box-shadow: 0 0 0 4px rgba(224, 184, 74, 0.16);
    border: 0;
  }

  .life-count {
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 620;
  }

  .live-board {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin: 0.85rem 0 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }

  .board-row {
    min-width: 0;
    background: var(--panel);
    border: 1px solid transparent;
    border-radius: 1.15rem;
    padding: 0.85rem 0.95rem 0.8rem;
  }

  .board-row.is-you {
    border-color: transparent;
    background: rgba(215, 176, 122, 0.14);
  }

  .board-row.is-standing .board-name {
    min-width: 0;
    flex: 1;
  }

  .board-row.is-out {
    opacity: 0.72;
  }

  .board-place,
  .board-mark {
    flex: none;
  }

  .board-place {
    min-width: 1.35rem;
    color: var(--gold);
    font-size: 0.95rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .board-mark {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: rgb(111, 191, 132);
    box-shadow: 0 0 0 4px rgba(111, 191, 132, 0.16);
  }

  .board-mark.is-out {
    background: transparent;
    box-shadow: none;
    border: 1.5px solid var(--muted);
  }

  .board-copy {
    min-width: 0;
    flex: 1;
  }

  .board-name,
  .board-sub {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .board-name {
    font-size: 1.02rem;
    font-weight: 620;
  }

  .board-sub {
    margin-top: 0.12rem;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .board-points {
    margin: 0;
    flex: none;
    font-size: 0.95rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .board-fraction {
    display: flex;
    align-items: baseline;
    flex: none;
    gap: 0.28rem;
    margin: 0;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }

  .board-fraction .eaten {
    font-size: clamp(1.35rem, 6vw, 1.7rem);
    font-weight: 650;
    letter-spacing: -0.03em;
  }

  .board-fraction .allowed {
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 620;
  }

  .out-mark {
    flex: none;
    margin: 0;
    padding: 0.28rem 0.6rem;
    border-radius: 999px;
    background: rgba(224, 184, 74, 0.16);
    color: rgb(224, 184, 74);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .board-track {
    height: 0.38rem;
    margin-top: 0.7rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
  }

  .board-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
  }

  .call-fill-on-track {
    background: rgb(111, 191, 132);
  }

  .call-fill-drifting {
    background: rgb(168, 188, 103);
  }

  .call-fill-running-hot {
    background: rgb(224, 184, 74);
  }

  .call-fill-over {
    background: rgb(214, 84, 78);
  }

  .call-fill-miss {
    background: var(--muted);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
