import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { fold } from "../shared/fold.js";

const memory = new Map<string, string>();

function installStorage(): void {
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, String(value));
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

installStorage();

describe("queue", { concurrency: false }, () => {
  beforeEach(() => memory.clear());

  it("keeps a tombstone after its create when an old log is backfilled", async () => {
    const { backfillCreates } = await import("./util.sync.js");
    const { loadQueue } = await import("./util.queue.js");
    const id = "22222222-2222-4222-8222-222222222222";
    backfillCreates({
      entries: [
        {
          id,
          calories: 40,
          timestamp: "2026-10-09T10:00:00.000Z",
          removed: true,
        },
      ],
      meals: [],
      goals: [],
    });
    const ops = loadQueue().ops;
    assert.equal(ops.length, 2);
    assert.equal(
      ops.every((item) => item.count === false),
      true,
    );
    const created = ops.find((item) => item.type === "entry.create");
    const removed = ops.find((item) => item.type === "entry.remove");
    assert.ok(created && removed);
    assert.ok(removed.occurredAt > created.occurredAt);
    const folded = fold(
      ops.map((item) => ({
        opId: item.opId,
        type: item.type,
        entityId: item.entityId,
        occurredAt: item.occurredAt,
        body: item.body,
      })),
    );
    assert.equal(folded.entries[0]?.removed, true);
    assert.equal(folded.entries[0]?.calories, 40);
  });

  it("restores one account without uploading the other account's queue", async () => {
    const queue = await import("./util.queue.js");
    const goal = "88888888-8888-4888-8888-888888888888";
    queue.saveQueue({ deviceId: "device-1", syncedUserId: "auth0|a", ops: [] });
    const created = queue.enqueue([
      {
        type: "goal.create",
        entityId: goal,
        occurredAt: "2026-10-09T00:00:00.000Z",
        count: false,
        body: { calories: 2000, setAt: "2026-10-09T00:00:00.000Z" },
      },
    ]);
    queue.stashAccount(
      "auth0|a",
      JSON.stringify({
        entries: [],
        meals: [],
        goals: [
          { id: goal, calories: 2000, setAt: "2026-10-09T00:00:00.000Z" },
        ],
      }),
    );
    queue.saveQueue({
      deviceId: "device-1",
      syncedUserId: "auth0|b",
      ops: [
        {
          opId: "99999999-9999-4999-8999-999999999999",
          type: "entry.create",
          entityId: "22222222-2222-4222-8222-222222222222",
          occurredAt: "2026-10-09T01:00:00.000Z",
          body: { calories: 10, eatenAt: "2026-10-09T01:00:00.000Z" },
          count: true,
        },
      ],
    });
    assert.equal(queue.restoreAccount("auth0|a"), true);
    const restored = queue.loadQueue();
    assert.equal(restored.deviceId, "device-1");
    assert.equal(restored.syncedUserId, "auth0|a");
    assert.equal(restored.ops.length, 1);
    assert.equal(restored.ops[0]?.opId, created[0]?.opId);
    assert.equal(
      restored.ops.some((item) => item.type === "entry.create"),
      false,
    );
    queue.resetOpenDocument("device-1");
    assert.equal(queue.loadQueue().deviceId, "device-1");
    assert.equal(queue.loadQueue().ops.length, 0);
    assert.equal(queue.loadQueue().syncedUserId, null);
  });
});
