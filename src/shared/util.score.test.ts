import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CalorieEntry, Fast } from "./type.nutrition.js";
import { addDays, parseDateKey } from "./util.dates.js";
import {
  assumedCalories,
  RED_OVER,
  toneLabel,
  UNTRACKED_FALLBACK,
  weightedOver,
} from "./util.score.js";

const today = "2026-10-14";

function entry(day: string, calories: number, removed = false): CalorieEntry {
  const date = parseDateKey(day);
  date.setHours(12, 0, 0, 0);
  return {
    id: `${day}-${calories}-${removed}`,
    calories,
    timestamp: date.toISOString(),
    ...(removed ? { removed } : {}),
  };
}

function fast(day: string, fasted: boolean, setAt: string): Fast {
  return { id: `${day}-${setAt}`, day, fasted, setAt };
}

describe("assumedCalories", () => {
  it("uses the logged total and ignores a fast mark", () => {
    const fasts = [fast(today, true, "2026-10-14T08:00:00.000Z")];
    assert.equal(
      assumedCalories(
        [entry(today, 700), entry(today, 100)],
        today,
        1800,
        fasts,
      ),
      800,
    );
  });

  it("counts a fasted day with no food as 0", () => {
    const fasts = [fast(today, true, "2026-10-14T08:00:00.000Z")];
    assert.equal(assumedCalories([], today, 1800, fasts), 0);
    assert.equal(
      assumedCalories([entry(today, 300, true)], today, 1800, fasts),
      0,
    );
  });

  it("counts an untracked day as the goal, or 2000 without one", () => {
    assert.equal(assumedCalories([], today, 1800), 1800);
    assert.equal(assumedCalories([], today, undefined), UNTRACKED_FALLBACK);
    assert.equal(UNTRACKED_FALLBACK, 2000);
    const off = [
      fast(today, true, "2026-10-14T08:00:00.000Z"),
      fast(today, false, "2026-10-14T09:00:00.000Z"),
    ];
    assert.equal(assumedCalories([], today, 1800, off), 1800);
  });
});

describe("weightedOver with untracked days", () => {
  it("turns red at 2230 against 1800 when earlier days are untracked", () => {
    const weighted = weightedOver([entry(today, 2230)], today, 1800);
    assert.equal(weighted, 430);
    assert.equal(toneLabel(weighted), "Over the window");
    assert.ok(weighted >= RED_OVER);
  });

  it("counts a fasted yesterday as 0 calories", () => {
    const yesterday = addDays(today, -1);
    const fasts = [fast(yesterday, true, "2026-10-13T08:00:00.000Z")];
    const weighted = weightedOver([entry(today, 2230)], today, 1800, fasts);
    assert.equal(Math.round(weighted), 430 - 900);
  });

  it("uses a logged day's real total", () => {
    const yesterday = addDays(today, -1);
    const weighted = weightedOver([entry(yesterday, 1000)], today, 1800);
    assert.equal(Math.round(weighted), -400);
  });
});
