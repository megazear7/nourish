import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { FileStore } from "./file-store.js";
import { handleApi } from "./handle.js";
import type { Authenticator } from "./auth.js";

const ENTRY = "22222222-2222-4222-8222-222222222222";
const OTHER = "44444444-4444-4444-8444-444444444444";

function op(partial: Record<string, unknown>) {
  return {
    opId: "11111111-1111-4111-8111-111111111111",
    type: "entry.create",
    entityId: ENTRY,
    occurredAt: "2026-10-09T15:00:00.000Z",
    body: { calories: 50, eatenAt: "2026-10-09T15:00:00.000Z" },
    ...partial,
  };
}

describe("api", { concurrency: false }, () => {
  let directory = "";
  let store: FileStore;

  before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "nourish-"));
    store = new FileStore(path.join(directory, "nourish.json"));
  });

  after(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  const auth: Authenticator = async (req) => {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token === "test-user") {
      return { userId: "auth0|test", email: "test@example.com" };
    }
    return null;
  };

  function call(
    method: string,
    pathname: string,
    body?: unknown,
    token?: string,
  ) {
    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("content-type", "application/json");
    return handleApi(
      new Request(`http://localhost${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      store,
      auth,
    );
  }

  it("refuses anonymous reads and writes", async () => {
    const read = await call("GET", "/api/state");
    const write = await call("POST", "/api/ops", { deviceId: null, ops: [] });
    assert.equal(read.status, 401);
    assert.equal(write.status, 401);
  });

  it("rejects a bearer token that is not a signed-in user", async () => {
    const denied = await call("GET", "/api/state", undefined, "not-a-user");
    assert.equal(denied.status, 401);
  });

  it("appends ops, folds a later edit over an older one, and survives a reload", async () => {
    const created = await call(
      "POST",
      "/api/ops",
      { deviceId: "55555555-5555-4555-8555-555555555555", ops: [op({})] },
      "test-user",
    );
    assert.equal(created.status, 200);
    const first = (await created.json()) as {
      results: { status: string }[];
      state: { entries: { calories: number }[] };
    };
    assert.equal(first.results[0]?.status, "applied");
    assert.equal(first.state.entries[0]?.calories, 50);

    const older = await call(
      "POST",
      "/.netlify/functions/api/ops",
      {
        deviceId: "55555555-5555-4555-8555-555555555555",
        ops: [
          op({
            opId: "66666666-6666-4666-8666-666666666666",
            type: "entry.patch",
            occurredAt: "2026-10-09T14:00:00.000Z",
            body: { calories: 80 },
          }),
          op({
            opId: "77777777-7777-4777-8777-777777777777",
            type: "entry.patch",
            occurredAt: "2026-10-09T16:00:00.000Z",
            body: { calories: 90 },
          }),
        ],
      },
      "test-user",
    );
    const folded = (await older.json()) as {
      state: { entries: { calories: number }[] };
    };
    assert.equal(folded.state.entries[0]?.calories, 90);

    const again = await call(
      "POST",
      "/api/ops",
      { ops: [op({})] },
      "test-user",
    );
    const duplicate = (await again.json()) as {
      results: { status: string }[];
      state: { entries: unknown[] };
    };
    assert.equal(duplicate.results[0]?.status, "duplicate");
    assert.equal(duplicate.state.entries.length, 1);

    const reloaded = new FileStore(path.join(directory, "nourish.json"));
    const read = await handleApi(
      new Request("http://localhost/api/state", {
        headers: { authorization: "Bearer test-user" },
      }),
      reloaded,
      auth,
    );
    const state = (await read.json()) as {
      entries: { calories: number }[];
      goals: unknown[];
    };
    assert.equal(state.entries[0]?.calories, 90);

    const goalId = "88888888-8888-4888-8888-888888888888";
    const goal = await call(
      "POST",
      "/api/ops",
      {
        ops: [
          {
            opId: "99999999-9999-4999-8999-999999999999",
            type: "goal.create",
            entityId: goalId,
            occurredAt: "2026-10-09T12:00:00.000Z",
            body: { calories: 1800, setAt: "2026-10-09T12:00:00.000Z" },
          },
        ],
      },
      "test-user",
    );
    const withGoal = (await goal.json()) as {
      state: { goals: { id: string; calories: number }[] };
    };
    assert.equal(withGoal.state.goals[0]?.id, goalId);
    assert.equal(withGoal.state.goals[0]?.calories, 1800);
  });

  it("rejects a fractional calorie and another user's entity", async () => {
    const mixed = await call(
      "POST",
      "/api/ops",
      {
        ops: [
          op({
            opId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            entityId: OTHER,
            body: { calories: 1.5, eatenAt: "2026-10-09T15:00:00.000Z" },
          }),
          op({
            opId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            entityId: OTHER,
            body: { calories: 25, eatenAt: "2026-10-09T15:00:00.000Z" },
          }),
        ],
      },
      "test-user",
    );
    const body = (await mixed.json()) as {
      results: { status: string }[];
      state: { entries: { id: string }[] };
    };
    assert.equal(body.results[0]?.status, "rejected");
    assert.equal(body.results[1]?.status, "applied");
    assert.equal(
      body.state.entries.some((entry) => entry.id === OTHER),
      true,
    );

    const stolen = await handleApi(
      new Request("http://localhost/api/ops", {
        method: "POST",
        headers: {
          authorization: "Bearer test-user",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ops: [
            op({
              opId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              type: "entry.patch",
              entityId: ENTRY,
              occurredAt: "2026-10-09T18:00:00.000Z",
              body: { calories: 1 },
            }),
          ],
        }),
      }),
      store,
      async () => ({ userId: "auth0|other", email: null }),
    );
    const conflict = (await stolen.json()) as {
      results: { status: string; reason?: string }[];
    };
    assert.equal(conflict.results[0]?.status, "rejected");
    assert.equal(conflict.results[0]?.reason, "conflict");
  });

  it("requires an ops array and ignores the service-worker shell path", async () => {
    const missing = await call("POST", "/api/ops", {}, "test-user");
    assert.equal(missing.status, 400);
    const worker = await readFile(
      path.join(process.cwd(), "public/sw.js"),
      "utf8",
    );
    assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  });
});
