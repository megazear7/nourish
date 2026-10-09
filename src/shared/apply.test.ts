import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptOps } from "./apply.js";

const create = {
  opId: "11111111-1111-4111-8111-111111111111",
  type: "entry.create",
  entityId: "22222222-2222-4222-8222-222222222222",
  occurredAt: "2026-10-09T10:00:00.000Z",
  body: { calories: 50, eatenAt: "2026-10-09T10:00:00.000Z" },
};

describe("acceptOps", () => {
  it("rejects a bad body and still applies the rest of the batch", () => {
    const outcome = acceptOps({
      userId: "auth0|a",
      incoming: [
        {
          ...create,
          body: { calories: 1.5, eatenAt: "2026-10-09T10:00:00.000Z" },
        },
        create,
      ],
      existing: [],
      entityOwners: [],
    });
    assert.equal(outcome.results[0]?.status, "rejected");
    assert.equal(outcome.results[1]?.status, "applied");
    assert.equal(outcome.state.entries.length, 1);
  });

  it("acks a repeated op id without folding it twice", () => {
    const first = acceptOps({
      userId: "auth0|a",
      incoming: [create],
      existing: [],
      entityOwners: [],
    });
    const second = acceptOps({
      userId: "auth0|a",
      incoming: [create],
      existing: first.accepted.map((op) => ({ userId: "auth0|a", op })),
      entityOwners: [
        { entityId: "22222222-2222-4222-8222-222222222222", userId: "auth0|a" },
      ],
    });
    assert.equal(second.results[0]?.status, "duplicate");
    assert.equal(second.accepted.length, 0);
    assert.equal(second.state.entries.length, 1);
  });

  it("rejects an op id or entity that belongs to someone else", () => {
    const outcome = acceptOps({
      userId: "auth0|b",
      incoming: [
        create,
        {
          ...create,
          opId: "33333333-3333-4333-8333-333333333333",
          entityId: "22222222-2222-4222-8222-222222222222",
        },
      ],
      existing: [
        { userId: "auth0|a", op: { ...create, type: "entry.create" } },
      ],
      entityOwners: [
        { entityId: "22222222-2222-4222-8222-222222222222", userId: "auth0|a" },
      ],
    });
    assert.equal(outcome.results[0]?.status, "rejected");
    assert.equal(outcome.results[1]?.status, "rejected");
    assert.equal(outcome.state.entries.length, 0);
  });
});
