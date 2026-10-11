# Nourish agent instructions

Read [features.md](features.md) before you change this repository. It is the source of truth for how the app works: every page, button, route, label, storage key, sync rule, and score.

Nourish is a very simple calorie tracker. The goal, written at the top of features.md, is the fewest clicks and the fewest decisions that still keep a day's calories up to date. Do not add UI, steps, or choices that make logging slower or heavier, unless the task explicitly asks for that.

When a change adds, removes, or alters behavior, update features.md in the same change. That includes a page, button, route, piece of copy, storage key, sync rule, or the color score. Do not leave features.md stale, and do not document a feature the code does not implement.

The running UI is `src/client/app.ts`. Files that features.md marks as unused are not the live app. Do not wire them back in while "cleaning up" unless the task says to.

## One instruction set for every agent

The text in this file is a copy, not a note for one tool. The copies are:

- `AGENTS.md` — Cursor, Codex, Grok, Copilot, and most other agents
- `CLAUDE.md` — Claude Code
- `GEMINI.md` — Gemini CLI
- `.github/copilot-instructions.md` — GitHub Copilot in VS Code, Visual Studio, JetBrains, and github.com
- `.cursor/rules/nourish.mdc` — Cursor, applied to every chat

When you add, remove, or edit any instruction for an AI working in this repository, write that same change into every file in the list, in the same commit. Do not update only the file your own tool reads. When you are done, the instruction text in all five files must match, except for a relative link to `features.md`. If a new tool needs its own file, add that file and add it to this list in every copy.
