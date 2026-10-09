import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fold, goalForDay } from "./fold.js";
import { normalizeState } from "./type.nutrition.js";
import type { Op } from "./type.op.js";

function op(partial: Omit<Op, "body"> & { body?: Op["body"] }): Op {
  return { body: {}, ...partial } as Op;
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
});
