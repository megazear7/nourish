import { CompetitionKind } from "../shared/type.competition.js";
import type { CompetitionDb } from "./competition-db.js";
import {
  acceptCompetition,
  addCompetitionEmail,
  CompetitionError,
  createCompetition,
  declineCompetition,
  listCompetitions,
  readCompetition,
  removeCompetitionEmail,
  startCompetition,
} from "./competitions.js";
import type { Authenticator } from "./auth.js";
import type { NourishStore } from "./store.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bare(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function route(pathname: string): "state" | "ops" | null {
  const path = bare(pathname);
  if (path.endsWith("/api/state")) return "state";
  if (path.endsWith("/api/ops")) return "ops";
  return null;
}

type CompetitionRoute =
  | { name: "list" }
  | { name: "one"; id: string }
  | { name: "emails"; id: string }
  | { name: "accept"; id: string }
  | { name: "decline"; id: string }
  | { name: "start"; id: string };

function competitionRoute(pathname: string): CompetitionRoute | null {
  const path = bare(pathname);
  const match = path.match(
    /\/api\/competitions(?:\/([^/]+)(?:\/(emails|accept|decline|start))?)?$/,
  );
  if (!match) return null;
  const id = match[1];
  const action = match[2];
  if (!id) return { name: "list" };
  if (!UUID.test(id)) return null;
  if (!action) return { name: "one", id };
  if (action === "emails") return { name: "emails", id };
  if (action === "accept") return { name: "accept", id };
  if (action === "decline") return { name: "decline", id };
  return { name: "start", id };
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function timezoneOf(url: URL, body: Record<string, unknown> | null): string {
  const fromBody =
    body && typeof body.timezone === "string" ? body.timezone : "";
  const fromQuery = url.searchParams.get("timezone") ?? "";
  return fromBody || fromQuery;
}

export async function handleApi(
  req: Request,
  store: NourishStore & CompetitionDb,
  authenticate: Authenticator,
): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const viewer = await authenticate(req);
  if (!viewer) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: JSON_HEADERS },
    );
  }
  try {
    const api = route(url.pathname);
    if (req.method === "GET" && api === "state") {
      const state = await store.read(viewer.userId, viewer.email);
      return Response.json(state, { headers: JSON_HEADERS });
    }
    if (req.method === "POST" && api === "ops") {
      const body = (await req.json()) as { deviceId?: unknown; ops?: unknown };
      if (!Array.isArray(body.ops)) {
        return Response.json(
          { error: "ops array required" },
          { status: 400, headers: JSON_HEADERS },
        );
      }
      if (body.ops.length > 1000) {
        return Response.json(
          { error: "too many ops" },
          { status: 400, headers: JSON_HEADERS },
        );
      }
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : null;
      const outcome = await store.sync(
        viewer.userId,
        viewer.email,
        deviceId,
        body.ops,
      );
      return Response.json(outcome, { headers: JSON_HEADERS });
    }
    const competition = competitionRoute(url.pathname);
    if (competition) {
      return await handleCompetition(req, url, store, viewer, competition);
    }
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: JSON_HEADERS },
    );
  } catch (error) {
    const status = error instanceof CompetitionError ? error.status : 500;
    const message = error instanceof Error ? error.message : "sync failed";
    return Response.json({ error: message }, { status, headers: JSON_HEADERS });
  }
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === "GET" || req.method === "HEAD") return {};
  const text = await req.text();
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CompetitionError("invalid body", 400);
  }
  return parsed as Record<string, unknown>;
}

async function handleCompetition(
  req: Request,
  url: URL,
  store: CompetitionDb,
  viewer: { userId: string; email: string | null },
  route: CompetitionRoute,
): Promise<Response> {
  const body = await readBody(req);
  const timezone = timezoneOf(url, body);
  if (route.name === "list" && req.method === "GET") {
    return Response.json(await listCompetitions(store, viewer, timezone), {
      headers: JSON_HEADERS,
    });
  }
  if (route.name === "list" && req.method === "POST") {
    const kind = CompetitionKind.safeParse(body.kind);
    if (!kind.success) {
      throw new CompetitionError("Pick a competition type.", 400);
    }
    if (!Array.isArray(body.emails)) {
      throw new CompetitionError("Add at least one email.", 400);
    }
    const emails = body.emails.filter(
      (email): email is string => typeof email === "string",
    );
    return Response.json(
      await createCompetition(store, viewer, {
        kind: kind.data,
        emails,
        timezone,
      }),
      { status: 201, headers: JSON_HEADERS },
    );
  }
  if (route.name === "one" && req.method === "GET") {
    return Response.json(
      await readCompetition(store, viewer, route.id, timezone),
      { headers: JSON_HEADERS },
    );
  }
  if (route.name === "emails" && req.method === "POST") {
    if (typeof body.email !== "string") {
      throw new CompetitionError("Enter an email address.", 400);
    }
    return Response.json(
      await addCompetitionEmail(store, viewer, route.id, body.email, timezone),
      { headers: JSON_HEADERS },
    );
  }
  if (route.name === "emails" && req.method === "DELETE") {
    const email = url.searchParams.get("email") ?? "";
    return Response.json(
      await removeCompetitionEmail(store, viewer, route.id, email, timezone),
      { headers: JSON_HEADERS },
    );
  }
  if (route.name === "accept" && req.method === "POST") {
    return Response.json(
      await acceptCompetition(store, viewer, route.id, timezone),
      { headers: JSON_HEADERS },
    );
  }
  if (route.name === "decline" && req.method === "POST") {
    await declineCompetition(store, viewer, route.id, timezone);
    return new Response(null, { status: 204 });
  }
  if (route.name === "start" && req.method === "POST") {
    return Response.json(
      await startCompetition(store, viewer, route.id, timezone),
      { headers: JSON_HEADERS },
    );
  }
  return Response.json(
    { error: "not_found" },
    { status: 404, headers: JSON_HEADERS },
  );
}
