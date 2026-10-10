import type { Authenticator } from "./auth.js";
import type { NourishStore } from "./store.js";

function route(pathname: string): "state" | "ops" | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/api/state" || path.endsWith("/api/state")) return "state";
  if (path === "/api/ops" || path.endsWith("/api/ops")) return "ops";
  return null;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export async function handleApi(
  req: Request,
  store: NourishStore,
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
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: JSON_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    return Response.json(
      { error: message },
      { status: 500, headers: JSON_HEADERS },
    );
  }
}
