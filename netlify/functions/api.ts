import type { Config } from "@netlify/functions";
import { liveAuth } from "../../src/server/auth.js";
import { handleApi } from "../../src/server/handle.js";
import { liveStore } from "../../src/server/postgres-store.js";

export default async function handler(req: Request): Promise<Response> {
  try {
    return await handleApi(req, liveStore(), liveAuth());
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export const config: Config = {
  path: ["/api/ops", "/api/state"],
  method: ["GET", "POST", "OPTIONS"],
};
