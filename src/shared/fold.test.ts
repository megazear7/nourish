import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fastForDay, fold, goalForDay, isFasted } from "./fold.js";
import { normalizeState } from "./type.nutrition.js";
import { addDays, parseDateKey } from "./util.dates.js";
import type { Op } from "./type.op.js";

function op(partial: Omit<Op, "body"> & { body?: Op["body"] }): Op {
  return { body: {}, ...partial } as Op;
}

function localIso(key: string, hours: number): string {
  const date = parseDateKey(key);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

describe("fold", () => {
  it("keeps five edits and lets the later occurredAt win", () => {
    const ops = [5, 4, 3, 2, 1].map((calories, index) =>
      op({
        opId: `p${index}`,
        type: "entry.patch",
        entityId: "e1",
        occurredAt: `2026-10-09T10:0${index}:00.000Z`,
        body: { calories: calories * 10 },
      }),
    );
    const state = fold([
      op({
        opId: "c1",
        type: "entry.create",
        entityId: "e1",
        occurredAt: "2026-10-09T09:00:00.000Z",
        body: { calories: 50, eatenAt: "2026-10-09T09:00:00.000Z" },
      }),
      ...ops,
    ]);
    assert.equal(state.entries[0]?.calories, 10);
  });

  it("does not let a late-arriving older edit clobber a newer one", () => {
    const state = fold([
      op({
        opId: "c",
        type: "entry.create",
        entityId: "e1",
        occurredAt: "2026-10-09T09:00:00.000Z",
        body: { calories: 50, eatenAt: "2026-10-09T09:00:00.000Z" },
      }),
      op({
        opId: "new",
        type: "entry.patch",
        entityId: "e1",
        occurredAt: "2026-10-09T12:00:00.000Z",
        body: { calories: 80 },
      }),
      op({
        opId: "old",
        type: "entry.patch",
        entityId: "e1",
        occurredAt: "2026-10-09T10:00:00.000Z",
        body: { calories: 60 },
      }),
    ]);
    assert.equal(state.entries[0]?.calories, 80);
  });

  it("applies a patch that was logged before its create once the create is in order", () => {
    const state = fold([
      op({
        opId: "p",
        type: "entry.patch",
        entityId: "e1",
        occurredAt: "2026-10-09T11:00:00.000Z",
        body: { calories: 90 },
      }),
      op({
        opId: "c",
        type: "entry.create",
        entityId: "e1",
        occurredAt: "2026-10-09T10:00:00.000Z",
        body: { calories: 50, eatenAt: "2026-10-09T10:00:00.000Z" },
      }),
    ]);
    assert.equal(state.entries[0]?.calories, 90);
  });

  it("collapses a quick-add group the way the edit sheet does", () => {
    const state = fold([
      op({
        opId: "a",
        type: "entry.create",
        entityId: "keep",
        occurredAt: "2026-10-09T10:00:00.000Z",
        body: { calories: 50, eatenAt: "2026-10-09T10:00:00.000Z" },
      }),
      op({
        opId: "b",
        type: "entry.create",
        entityId: "drop",
        occurredAt: "2026-10-09T10:00:20.000Z",
        body: { calories: 100, eatenAt: "2026-10-09T10:00:20.000Z" },
      }),
      op({
        opId: "patch",
        type: "entry.patch",
        entityId: "keep",
        occurredAt: "2026-10-09T10:05:00.000Z",
        body: { calories: 150 },
      }),
      op({
        opId: "rm",
        type: "entry.remove",
        entityId: "drop",
        occurredAt: "2026-10-09T10:05:00.000Z",
      }),
    ]);
    const keep = state.entries.find((entry) => entry.id === "keep");
    const drop = state.entries.find((entry) => entry.id === "drop");
    assert.equal(keep?.calories, 150);
    assert.equal(keep?.removed, undefined);
    assert.equal(drop?.removed, true);
  });

  it("names a calorie entry without creating a meal", () => {
    const state = fold([
      op({
        opId: "c",
        type: "entry.create",
        entityId: "e1",
        occurredAt: "2026-10-09T10:00:00.000Z",
        body: { calories: 180, eatenAt: "2026-10-09T10:00:00.000Z" },
      }),
      op({
        opId: "p",
        type: "entry.patch",
        entityId: "e1",
        occurredAt: "2026-10-09T10:05:00.000Z",
        body: { calories: 180, mealTitle: "Coffee" },
      }),
    ]);
    assert.equal(state.entries[0]?.mealTitle, "Coffee");
    assert.equal(state.entries[0]?.mealId, undefined);
    assert.equal(state.meals.length, 0);
  });

  it("clears a calorie entry title without touching meals", () => {
    const state = fold([
      op({
        opId: "c",
        type: "entry.create",
        entityId: "e1",
        occurredAt: "2026-10-09T10:00:00.000Z",
        body: {
          calories: 180,
          eatenAt: "2026-10-09T10:00:00.000Z",
          mealTitle: "Coffee",
        },
      }),
      op({
        opId: "p",
        type: "entry.patch",
        entityId: "e1",
        occurredAt: "2026-10-09T10:05:00.000Z",
        body: { mealTitle: "" },
      }),
    ]);
    assert.equal(state.entries[0]?.mealTitle, "");
    assert.equal(state.meals.length, 0);
  });

  it("appends goals and picks the one in effect for a day", () => {
    const goals = fold([
      op({
        opId: "g1",
        type: "goal.create",
        entityId: "g1",
        occurredAt: "2026-10-01T15:00:00.000Z",
        body: { calories: 2000, setAt: "2026-10-01T15:00:00.000Z" },
      }),
      op({
        opId: "g2",
        type: "goal.create",
        entityId: "g2",
        occurredAt: "2026-10-08T15:00:00.000Z",
        body: { calories: 1800, setAt: "2026-10-08T15:00:00.000Z" },
      }),
    ]).goals;
    assert.equal(goalForDay(goals, "2026-10-02")?.calories, 2000);
    assert.equal(goalForDay(goals, "2026-10-09")?.calories, 1800);
    assert.equal(goalForDay(goals, "2026-09-01"), undefined);
  });

  it("keeps a day-scoped goal on that day only", () => {
    const first = localIso("2026-10-01", 15);
    const overrideAt = localIso("2026-10-13", 9);
    const later = localIso("2026-10-13", 16);
    const goals = fold([
      op({
        opId: "g1",
        type: "goal.create",
        entityId: "g1",
        occurredAt: first,
        body: { calories: 2000, setAt: first },
      }),
      op({
        opId: "g-day",
        type: "goal.create",
        entityId: "g-day",
        occurredAt: overrideAt,
        body: { calories: 1600, setAt: overrideAt, day: "2026-10-05" },
      }),
      op({
        opId: "g2",
        type: "goal.create",
        entityId: "g2",
        occurredAt: later,
        body: { calories: 1800, setAt: later },
      }),
    ]).goals;
    assert.equal(goals.find((goal) => goal.id === "g-day")?.day, "2026-10-05");
    assert.equal(goalForDay(goals, "2026-10-04")?.calories, 2000);
    assert.equal(goalForDay(goals, "2026-10-05")?.calories, 1600);
    assert.equal(goalForDay(goals, "2026-10-06")?.calories, 2000);
    assert.equal(goalForDay(goals, "2026-10-12")?.calories, 2000);
    assert.equal(goalForDay(goals, "2026-10-13")?.calories, 1800);
    assert.equal(goalForDay(goals, "2026-10-14")?.calories, 1800);
    assert.equal(goalForDay(goals, "2026-09-01"), undefined);
  });

  it("lets a later forward goal saved that same day replace a one-day goal", () => {
    const day = "2026-10-05";
    const overrideAt = localIso(day, 10);
    const forwardAt = localIso(day, 15);
    const goals = fold([
      op({
        opId: "day",
        type: "goal.create",
        entityId: "day",
        occurredAt: overrideAt,
        body: { calories: 1600, setAt: overrideAt, day },
      }),
      op({
        opId: "forward",
        type: "goal.create",
        entityId: "forward",
        occurredAt: forwardAt,
        body: { calories: 1800, setAt: forwardAt },
      }),
    ]).goals;
    assert.equal(goalForDay(goals, day)?.calories, 1800);
    assert.equal(goalForDay(goals, addDays(day, 1))?.calories, 1800);
    assert.equal(goalForDay(goals, addDays(day, -1)), undefined);
  });

  it("uses a one-day goal when no forward goal exists", () => {
    const at = localIso("2026-10-13", 9);
    const goals = fold([
      op({
        opId: "only",
        type: "goal.create",
        entityId: "only",
        occurredAt: at,
        body: { calories: 1600, setAt: at, day: "2026-10-05" },
      }),
    ]).goals;
    assert.equal(goalForDay(goals, "2026-10-05")?.calories, 1600);
    assert.equal(goalForDay(goals, "2026-10-06"), undefined);
  });

  it("turns the old single goal into one row and then drops it", () => {
    const first = normalizeState(
      { entries: [], meals: [], goal: { calories: 2200 } },
      () => ({ id: "migrated", setAt: "2026-10-09T00:00:00.000Z" }),
    );
    assert.equal(first?.migrated, true);
    assert.equal(first?.state.goals[0]?.id, "migrated");
    assert.equal(first?.state.goals[0]?.calories, 2200);
    const second = normalizeState(first?.state, () => ({
      id: "again",
      setAt: "2026-10-10T00:00:00.000Z",
    }));
    assert.equal(second?.state.goals.length, 1);
    assert.equal(second?.state.goals[0]?.id, "migrated");
  });

  it("reorders meals and puts a later create at the front", () => {
    const meal = (id: string, title: string, at: string): Op =>
      op({
        opId: `c-${id}`,
        type: "meal.create",
        entityId: id,
        occurredAt: at,
        body: { title, description: "", calories: 100 },
      });
    const state = fold([
      meal("a", "A", "2026-10-01T00:00:00.000Z"),
      meal("b", "B", "2026-10-02T00:00:00.000Z"),
      meal("c", "C", "2026-10-03T00:00:00.000Z"),
      op({
        opId: "order",
        type: "meal.reorder",
        entityId: "b",
        occurredAt: "2026-10-04T00:00:00.000Z",
        body: { ids: ["c", "a", "b"] },
      }),
      meal("d", "D", "2026-10-05T00:00:00.000Z"),
    ]);
    assert.deepEqual(
      state.meals.map((item) => item.id),
      ["d", "c", "a", "b"],
    );
  });

  it("keeps meals missing from a reorder in their previous order", () => {
    const state = fold([
      op({
        opId: "c-a",
        type: "meal.create",
        entityId: "a",
        occurredAt: "2026-10-01T00:00:00.000Z",
        body: { title: "A", description: "", calories: 1 },
      }),
      op({
        opId: "c-b",
        type: "meal.create",
        entityId: "b",
        occurredAt: "2026-10-02T00:00:00.000Z",
        body: { title: "B", description: "", calories: 1 },
      }),
      op({
        opId: "order",
        type: "meal.reorder",
        entityId: "a",
        occurredAt: "2026-10-03T00:00:00.000Z",
        body: { ids: ["b", "missing"] },
      }),
    ]);
    assert.deepEqual(
      state.meals.map((item) => item.id),
      ["b", "a"],
    );
  });
});

describe("fasts", () => {
  const fastOp = (
    id: string,
    at: string,
    fasted: boolean,
    day = "2026-10-05",
  ) =>
    op({
      opId: `o-${id}`,
      type: "fast.set",
      entityId: id,
      occurredAt: at,
      body: { day, fasted, setAt: at },
    });

  it("lets the later fast.set for a day win and fasted false clears it", () => {
    const on = fastOp("f1", "2026-10-05T10:00:00.000Z", true);
    const off = fastOp("f2", "2026-10-05T11:00:00.000Z", false);
    assert.equal(isFasted(fold([on]).fasts, "2026-10-05"), true);
    const both = fold([off, on]);
    assert.equal(both.fasts.length, 2);
    assert.equal(isFasted(both.fasts, "2026-10-05"), false);
    assert.equal(isFasted(both.fasts, "2026-10-06"), false);
  });

  it("breaks a setAt tie with the greater id", () => {
    const at = "2026-10-05T10:00:00.000Z";
    const state = fold([fastOp("a", at, true), fastOp("b", at, false)]);
    assert.equal(fastForDay(state.fasts, "2026-10-05")?.id, "b");
  });
});

describe("normalizeState fasts", () => {
  it("loads a document without fasts", () => {
    const loaded = normalizeState(
      { entries: [], meals: [], goals: [] },
      () => ({
        id: "x",
        setAt: "2026-10-05T10:00:00.000Z",
      }),
    );
    assert.deepEqual(loaded?.state.fasts, []);
  });
});
