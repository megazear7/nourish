# Nourish agent instructions

Read [features.md](features.md) before you change this repository. It is the source of truth for how the app works: every page, button, route, label, storage key, sync rule, and score.

Nourish is a very simple calorie tracker. The goal, written at the top of features.md, is the fewest clicks and the fewest decisions that still keep a day's calories up to date. Do not add UI, steps, or choices that make logging slower or heavier, unless the task explicitly asks for that.

When a change adds, removes, or alters behavior, update features.md in the same change. That includes a page, button, route, piece of copy, storage key, sync rule, or the color score. Do not leave features.md stale, and do not document a feature the code does not implement.

The running UI is `src/client/app.ts`. Files that features.md marks as unused are not the live app. Do not wire them back in while "cleaning up" unless the task says to.

These same instructions are in `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and `.cursor/rules/nourish.mdc`. If you change the instructions, change all of those files together.
