import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TimedOp } from "./util.competition.js";
import {
  dayCall,
  foldAt,
  pointsFor,
  scoreCompetition,
} from "./util.competition.js";
import { fold } from "./fold.js";
import type { Op } from "./type.op.js";
import { dateKeyInZone, zonedEndExclusive, zonedStart } from "./util.zone.js";

const ZONE = "America/New_York";

function op(partial: Partial<Op> & Pick<Op, "type" | "body">): Op {
  return {
    opId: partial.opId ?? "11111111-1111-4111-8111-111111111111",
    entityId: partial.entityId ?? "22222222-2222-4222-8222-222222222222",
    occurredAt: partial.occurredAt ?? "2026-10-25T15:00:00.000Z",
    type: partial.type,
    body: partial.body,
  };
}

function timed(opValue: Op, receivedAt: string): TimedOp {
  return { op: opValue, receivedAt };
}

function goal(id: string, calories: number, setAt: string, day?: string): Op {
  return op({
    opId: id,
    entityId: id,
    type: "goal.create",
    occurredAt: setAt,
    body: { calories, setAt, ...(day ? { day } : {}) },
  });
}

function entry(id: string, calories: number, eatenAt: string): Op {
  return op({
    opId: id,
    entityId: id,
    type: "entry.create",
    occurredAt: eatenAt,
    body: { calories, eatenAt },
  });
}

function fast(id: string, day: string, setAt: string): Op {
  return op({
    opId: id,
    entityId: id,
    type: "fast.set",
    occurredAt: setAt,
    body: { day, fasted: true, setAt },
  });
}

const GOAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTRY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("zone boundaries", () => {
  it("locks an October day at New York midnight, which is 04:00 UTC", () => {
    const end = zonedEndExclusive("2026-10-25", ZONE);
    assert.equal(end.toISOString(), "2026-10-26T04:00:00.000Z");
    assert.equal(
      dateKeyInZone(zonedStart("2026-10-25", ZONE), ZONE),
      "2026-10-25",
    );
    assert.equal(
      dateKeyInZone(zonedStart("2026-03-08", ZONE), ZONE),
      "2026-03-08",
    );
    assert.equal(
      dateKeyInZone(zonedStart("2026-11-01", ZONE), ZONE),
      "2026-11-01",
    );
  });
});

describe("day calls", () => {
  const early = "2026-10-20T12:00:00.000Z";

  it("scores on track, drifting, running hot, and over from the weighted label", () => {
    const base = [timed(goal(GOAL, 2000, early), early)];
    const onTrack = foldAt(
      [
        ...base,
        timed(
          entry(ENTRY, 1800, "2026-10-25T16:00:00.000Z"),
          "2026-10-25T16:00:00.000Z",
        ),
      ],
      new Date("2026-10-26T04:00:00.000Z"),
    );
    assert.equal(dayCall(onTrack, "2026-10-25", ZONE), "on-track");
    assert.equal(pointsFor("on-track"), 1);

    const drifting = foldAt(
      [
        ...base,
        timed(
          entry(ENTRY, 2100, "2026-10-25T16:00:00.000Z"),
          "2026-10-25T16:00:00.000Z",
        ),
      ],
      new Date("2026-10-26T04:00:00.000Z"),
    );
    assert.equal(dayCall(drifting, "2026-10-25", ZONE), "drifting");
    assert.equal(pointsFor("drifting"), 0);

    const hot = foldAt(
      [
        ...base,
        timed(
          entry(ENTRY, 2400, "2026-10-25T16:00:00.000Z"),
          "2026-10-25T16:00:00.000Z",
        ),
      ],
      new Date("2026-10-26T04:00:00.000Z"),
    );
    assert.equal(dayCall(hot, "2026-10-25", ZONE), "running-hot");
    assert.equal(pointsFor("running-hot"), -1);

    const over = foldAt(
      [
        ...base,
        timed(
          entry(ENTRY, 2800, "2026-10-25T16:00:00.000Z"),
          "2026-10-25T16:00:00.000Z",
        ),
      ],
      new Date("2026-10-26T04:00:00.000Z"),
    );
    assert.equal(dayCall(over, "2026-10-25", ZONE), "over");
    assert.equal(pointsFor("over"), -1);
  });

  it("treats a day with no log and no fast as a miss, and a fast with no log as on track", () => {
    const ops = [timed(goal(GOAL, 2000, early), early)];
    const state = fold(ops.map((row) => row.op));
    assert.equal(dayCall(state, "2026-10-25", ZONE), "miss");
    assert.equal(pointsFor("miss"), -1);

    const fasted = fold([
      ...ops.map((row) => row.op),
      fast("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "2026-10-25", early),
    ]);
    assert.equal(dayCall(fasted, "2026-10-25", ZONE), "on-track");
  });

  it("treats a day with no goal as a miss", () => {
    const state = fold([entry(ENTRY, 500, "2026-10-25T16:00:00.000Z")]);
    assert.equal(dayCall(state, "2026-10-25", ZONE), "miss");
  });

  it("ignores an edit that arrives after local midnight", () => {
    const created = timed(
      entry(ENTRY, 1800, "2026-10-25T16:00:00.000Z"),
      "2026-10-25T16:00:00.000Z",
    );
    const late = timed(
      op({
        opId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        entityId: ENTRY,
        type: "entry.patch",
        occurredAt: "2026-10-25T18:00:00.000Z",
        body: { calories: 2800 },
      }),
      "2026-10-26T05:00:00.000Z",
    );
    const goalOp = timed(goal(GOAL, 2000, early), early);
    const locked = foldAt(
      [goalOp, created, late],
      zonedEndExclusive("2026-10-25", ZONE),
    );
    assert.equal(dayCall(locked, "2026-10-25", ZONE), "on-track");
    const live = fold([goalOp, created, late].map((row) => row.op));
    assert.equal(dayCall(live, "2026-10-25", ZONE), "over");
  });
});

describe("last one standing", () => {
  const early = "2026-10-01T12:00:00.000Z";
  const now = new Date("2026-10-26T12:00:00.000Z");

  function player(email: string, ops: TimedOp[], timeZone = ZONE) {
    return { email, timeZone, ops };
  }

  function tracked(calories: number, eatenAt: string, receivedAt = eatenAt) {
    return [
      timed(goal(GOAL, 2000, early), early),
      timed(entry(ENTRY, calories, eatenAt), receivedAt),
    ];
  }

  it("names the last player in, and shares the win when the last players drop together", () => {
    const sole = scoreCompetition({
      kind: "last_one_standing",
      startDay: "2026-10-25",
      monthEnd: null,
      now,
      players: [
        player("a@example.com", tracked(1800, "2026-10-25T16:00:00.000Z")),
        player("b@example.com", [timed(goal(GOAL, 2000, early), early)]),
      ],
    });
    assert.equal(sole.completed, true);
    assert.deepEqual(sole.winners, ["a@example.com"]);
    assert.equal(
      sole.players.find((row) => row.email === "b@example.com")?.knockedOutOn,
      "2026-10-25",
    );
    assert.equal(
      sole.players.every((row) => row.caloriesToday === null),
      true,
    );

    const shared = scoreCompetition({
      kind: "last_one_standing",
      startDay: "2026-10-25",
      monthEnd: null,
      now,
      players: [
        player("a@example.com", [timed(goal(GOAL, 2000, early), early)]),
        player("b@example.com", [timed(goal(GOAL, 2000, early), early)]),
      ],
    });
    assert.equal(shared.completed, true);
    assert.deepEqual(shared.winners, ["a@example.com", "b@example.com"]);
  });

  it("does not knock anyone out while a remaining player's day is still open", () => {
    const board = scoreCompetition({
      kind: "last_one_standing",
      startDay: "2026-10-25",
      monthEnd: null,
      now: new Date("2026-10-26T03:30:00.000Z"),
      players: [
        player("a@example.com", [timed(goal(GOAL, 2000, early), early)]),
        player("b@example.com", tracked(1800, "2026-10-25T16:00:00.000Z")),
      ],
    });
    assert.equal(board.completed, false);
    assert.equal(board.winners.length, 0);
    assert.equal(
      board.players.every((row) => row.alive),
      true,
    );
    assert.equal(
      board.players.find((row) => row.email === "a@example.com")?.today,
      "miss",
    );
    assert.equal(
      board.players.find((row) => row.email === "a@example.com")?.caloriesToday,
      0,
    );
    assert.equal(
      board.players.find((row) => row.email === "b@example.com")?.caloriesToday,
      1800,
    );
  });

  it("waits to declare a winner when a slower timezone has not locked that day", () => {
    const board = scoreCompetition({
      kind: "last_one_standing",
      startDay: "2026-10-25",
      monthEnd: null,
      now: new Date("2026-10-26T06:00:00.000Z"),
      players: [
        player(
          "tokyo@example.com",
          [timed(goal(GOAL, 2000, early), early)],
          "Asia/Tokyo",
        ),
        player(
          "honolulu@example.com",
          tracked(1800, "2026-10-25T16:00:00.000Z"),
          "Pacific/Honolulu",
        ),
      ],
    });
    assert.equal(board.completed, false);
    assert.equal(
      board.players.every((row) => row.alive),
      true,
    );
  });

  it("counts calories eaten today for everyone still on the board, including someone already out", () => {
    const day = "2026-10-24T16:00:00.000Z";
    const today = "2026-10-25T16:00:00.000Z";
    const eaten = (id: string, calories: number, at: string) =>
      timed(entry(id, calories, at), at);
    const board = scoreCompetition({
      kind: "last_one_standing",
      startDay: "2026-10-24",
      monthEnd: null,
      now: new Date("2026-10-25T18:00:00.000Z"),
      players: [
        player("alive@example.com", [
          timed(goal(GOAL, 2000, early), early),
          eaten("cccccccc-cccc-4ccc-8ccc-cccccccccccc", 1800, day),
          eaten("dddddddd-dddd-4ddd-8ddd-dddddddddddd", 640, today),
        ]),
        player("also@example.com", [
          timed(goal(GOAL, 2000, early), early),
          eaten("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", 1800, day),
          eaten("ffffffff-ffff-4fff-8fff-ffffffffffff", 1200, today),
        ]),
        player("out@example.com", [
          timed(goal(GOAL, 2000, early), early),
          eaten("99999999-9999-4999-8999-999999999999", 2100, today),
        ]),
      ],
    });
    assert.equal(board.completed, false);
    const out = board.players.find((row) => row.email === "out@example.com");
    assert.equal(out?.knockedOutOn, "2026-10-24");
    assert.equal(out?.alive, false);
    assert.notEqual(out?.today, null);
    assert.equal(out?.caloriesToday, 2100);
    assert.equal(
      board.players.find((row) => row.email === "alive@example.com")
        ?.caloriesToday,
      640,
    );
    assert.equal(
      board.players.find((row) => row.email === "also@example.com")
        ?.caloriesToday,
      1200,
    );
  });
});

describe("best of the month", () => {
  const early = "2026-10-01T12:00:00.000Z";

  it("scores from the start day through month end and shares a tie", () => {
    const eaten = "2026-10-31T16:00:00.000Z";
    const green = [
      timed(goal(GOAL, 2000, early), early),
      timed(entry(ENTRY, 1800, eaten), eaten),
    ];
    const missed = [timed(goal(GOAL, 2000, early), early)];
    const board = scoreCompetition({
      kind: "best_of_month",
      startDay: "2026-10-31",
      monthEnd: "2026-10-31",
      now: new Date("2026-11-01T05:00:00.000Z"),
      players: [
        { email: "a@example.com", timeZone: ZONE, ops: green },
        { email: "b@example.com", timeZone: ZONE, ops: green },
        { email: "c@example.com", timeZone: ZONE, ops: missed },
      ],
    });
    assert.equal(board.completed, true);
    assert.deepEqual(board.winners, ["a@example.com", "b@example.com"]);
    assert.equal(
      board.players.find((row) => row.email === "a@example.com")?.points,
      1,
    );
    assert.equal(
      board.players.find((row) => row.email === "c@example.com")?.points,
      -1,
    );
  });

  it("leaves the current day provisional and does not finish the month early", () => {
    const board = scoreCompetition({
      kind: "best_of_month",
      startDay: "2026-10-25",
      monthEnd: "2026-10-31",
      now: new Date("2026-10-25T18:00:00.000Z"),
      players: [
        {
          email: "a@example.com",
          timeZone: ZONE,
          ops: [timed(goal(GOAL, 2000, early), early)],
        },
      ],
    });
    assert.equal(board.completed, false);
    assert.equal(board.players[0]?.points, 0);
    assert.equal(board.players[0]?.today, "miss");
    assert.equal(board.players[0]?.caloriesToday, 0);
  });

  it("does not score days before start", () => {
    const before = "2026-10-24T16:00:00.000Z";
    const board = scoreCompetition({
      kind: "best_of_month",
      startDay: "2026-10-25",
      monthEnd: "2026-10-25",
      now: new Date("2026-10-26T05:00:00.000Z"),
      players: [
        {
          email: "a@example.com",
          timeZone: ZONE,
          ops: [
            timed(goal(GOAL, 2000, early), early),
            timed(entry(ENTRY, 1800, before), before),
          ],
        },
      ],
    });
    assert.equal(board.completed, true);
    assert.equal(board.players[0]?.points, -1);
    assert.equal(board.players[0]?.caloriesToday, null);
  });

  it("does not publish calories from before the start day", () => {
    const before = "2026-10-24T16:00:00.000Z";
    const board = scoreCompetition({
      kind: "best_of_month",
      startDay: "2026-10-25",
      monthEnd: "2026-10-31",
      now: new Date("2026-10-24T18:00:00.000Z"),
      players: [
        {
          email: "a@example.com",
          timeZone: ZONE,
          ops: [
            timed(goal(GOAL, 2000, early), early),
            timed(entry(ENTRY, 500, before), before),
          ],
        },
      ],
    });
    assert.equal(board.completed, false);
    assert.equal(board.players[0]?.caloriesToday, null);
  });
});
