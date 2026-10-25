import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { CompetitionView } from "../shared/type.competition.js";
import type { Authenticator } from "./auth.js";
import { FileStore } from "./file-store.js";
import { handleApi } from "./handle.js";

const ZONE = "America/New_York";
const GOAL = "99999999-9999-4999-8999-999999999999";

describe("competitions api", { concurrency: false }, () => {
  let directory = "";
  let store: FileStore;

  before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "nourish-comp-"));
    store = new FileStore(path.join(directory, "nourish.json"));
  });

  after(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  const auth: Authenticator = async (req) => {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token === "host")
      return { userId: "auth0|host", email: "Host@Example.com" };
    if (token === "guest")
      return { userId: "auth0|guest", email: "guest@example.com" };
    if (token === "other")
      return { userId: "auth0|other", email: "other@example.com" };
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
    const url = pathname.includes("timezone=")
      ? pathname
      : `${pathname}${pathname.includes("?") ? "&" : "?"}timezone=${ZONE}`;
    return handleApi(
      new Request(`http://localhost${url}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      store,
      auth,
    );
  }

  async function goalFor(token: string, id: string) {
    const saved = await call(
      "POST",
      "/api/ops",
      {
        ops: [
          {
            opId: id,
            type: "goal.create",
            entityId: id,
            occurredAt: "2026-10-01T15:00:00.000Z",
            body: { calories: 2000, setAt: "2026-10-01T15:00:00.000Z" },
          },
        ],
      },
      token,
    );
    assert.equal(saved.status, 200);
  }

  it("requires a signed-in email, a goal, a type, and someone else", async () => {
    const anonymous = await call("GET", "/api/competitions");
    assert.equal(anonymous.status, 401);

    const noGoal = await call(
      "POST",
      "/api/competitions",
      {
        kind: "last_one_standing",
        emails: ["guest@example.com"],
        timezone: ZONE,
      },
      "host",
    );
    assert.equal(noGoal.status, 400);
    assert.match(await noGoal.text(), /goal/i);

    await goalFor("host", GOAL);

    const empty = await call(
      "POST",
      "/api/competitions",
      { kind: "last_one_standing", emails: [], timezone: ZONE },
      "host",
    );
    assert.equal(empty.status, 400);

    const self = await call(
      "POST",
      "/api/competitions",
      {
        kind: "last_one_standing",
        emails: ["host@example.com"],
        timezone: ZONE,
      },
      "host",
    );
    assert.equal(self.status, 400);
  });

  it("invites by email, blocks start until everyone accepts, then freezes the roster", async () => {
    const created = await call(
      "POST",
      "/api/competitions",
      {
        kind: "last_one_standing",
        emails: ["Guest@Example.com"],
        timezone: ZONE,
      },
      "host",
    );
    assert.equal(created.status, 201);
    const competition = (await created.json()) as CompetitionView;
    assert.equal(competition.phase, "waiting");
    assert.equal(competition.canStart, false);
    assert.equal(competition.host, true);
    assert.equal(JSON.stringify(competition).includes("calories"), false);
    assert.equal(JSON.stringify(competition).includes("entries"), false);
    const guest = competition.members.find(
      (member) => member.email === "guest@example.com",
    );
    assert.equal(guest?.invite, "pending");

    const hidden = await call(
      "GET",
      `/api/competitions/${competition.id}`,
      undefined,
      "other",
    );
    assert.equal(hidden.status, 404);

    const seen = await call("GET", "/api/competitions", undefined, "guest");
    const list = (await seen.json()) as {
      competitions: CompetitionView[];
      suggestions: string[];
    };
    assert.equal(
      list.competitions.some((item) => item.id === competition.id),
      true,
    );

    const noGoal = await call(
      "POST",
      `/api/competitions/${competition.id}/accept`,
      { timezone: ZONE },
      "guest",
    );
    assert.equal(noGoal.status, 400);

    await goalFor("guest", "88888888-8888-4888-8888-888888888888");
    const accepted = await call(
      "POST",
      `/api/competitions/${competition.id}/accept`,
      { timezone: ZONE },
      "guest",
    );
    assert.equal(accepted.status, 200);

    const early = await call(
      "POST",
      `/api/competitions/${competition.id}/start`,
      { timezone: ZONE },
      "guest",
    );
    assert.equal(early.status, 403);

    const started = await call(
      "POST",
      `/api/competitions/${competition.id}/start`,
      { timezone: ZONE },
      "host",
    );
    assert.equal(started.status, 200);
    const live = (await started.json()) as CompetitionView;
    assert.equal(live.phase, "active");
    assert.equal(
      live.members.every((member) => member.standing !== null),
      true,
    );
    assert.equal(JSON.stringify(live).includes("calories"), false);

    const added = await call(
      "POST",
      `/api/competitions/${competition.id}/emails`,
      { email: "other@example.com", timezone: ZONE },
      "host",
    );
    assert.equal(added.status, 400);

    const suggestions = await call(
      "GET",
      "/api/competitions",
      undefined,
      "host",
    );
    const hostList = (await suggestions.json()) as { suggestions: string[] };
    assert.deepEqual(hostList.suggestions, ["guest@example.com"]);
  });

  it("lets an invitee decline, which drops them from the roster", async () => {
    const created = await call(
      "POST",
      "/api/competitions",
      {
        kind: "best_of_month",
        emails: ["guest@example.com"],
        timezone: ZONE,
      },
      "host",
    );
    const competition = (await created.json()) as CompetitionView;
    const declined = await call(
      "POST",
      `/api/competitions/${competition.id}/decline`,
      { timezone: ZONE },
      "guest",
    );
    assert.equal(declined.status, 204);
    const again = await call(
      "GET",
      `/api/competitions/${competition.id}`,
      undefined,
      "host",
    );
    const view = (await again.json()) as CompetitionView;
    assert.equal(
      view.members.some((member) => member.email === "guest@example.com"),
      false,
    );
    const suggestions = await call(
      "GET",
      "/api/competitions",
      undefined,
      "host",
    );
    const hostList = (await suggestions.json()) as { suggestions: string[] };
    assert.deepEqual(hostList.suggestions, ["guest@example.com"]);
  });
});
