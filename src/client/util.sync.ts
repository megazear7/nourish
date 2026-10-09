import { fold } from "../shared/fold.js";
import type { NutritionState } from "../shared/type.nutrition.js";
import type { OpResult } from "../shared/type.op.js";
import { saveState } from "./util.storage.js";
import {
  dropOps,
  enqueue,
  loadQueue,
  type OpDraft,
  type QueuedOp,
} from "./util.queue.js";

export type SyncResponse = {
  results?: OpResult[];
  state?: NutritionState;
  entries?: NutritionState["entries"];
  meals?: NutritionState["meals"];
  goals?: NutritionState["goals"];
};

function stateFrom(
  payload: SyncResponse | NutritionState,
): NutritionState | null {
  if ("state" in payload && payload.state) return payload.state;
  if (
    "entries" in payload &&
    Array.isArray(payload.entries) &&
    "meals" in payload &&
    "goals" in payload
  ) {
    return {
      entries: payload.entries,
      meals: payload.meals ?? [],
      goals: payload.goals ?? [],
    };
  }
  return null;
}

function paint(base: NutritionState, pending: QueuedOp[]): NutritionState {
  if (!pending.length) return base;
  return fold(
    pending.map((op) => ({
      opId: op.opId,
      type: op.type,
      entityId: op.entityId,
      occurredAt: op.occurredAt,
      body: op.body,
    })),
    base,
  );
}

let chain: Promise<void> = Promise.resolve();

export function flushSync(
  token: string,
  onState: (state: NutritionState) => void,
  onError: (message: string) => void,
): Promise<void> {
  const run = chain.then(() => pushAndPull(token, onState, onError));
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function pushAndPull(
  token: string,
  onState: (state: NutritionState) => void,
  onError: (message: string) => void,
): Promise<void> {
  const queue = loadQueue();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (queue.ops.length) {
    const response = await fetch("/api/ops", {
      method: "POST",
      headers,
      body: JSON.stringify({
        deviceId: queue.deviceId,
        ops: queue.ops.map(({ count: _count, ...op }) => op),
      }),
    });
    if (response.status === 401) throw new Error("Sign in again to sync.");
    if (!response.ok) throw new Error(`Sync failed (${response.status}).`);
    const payload = (await response.json()) as SyncResponse;
    const finished = (payload.results ?? [])
      .filter(
        (result) =>
          result.status === "applied" || result.status === "duplicate",
      )
      .map((result) => result.opId);
    dropOps(finished);
    const rejected = (payload.results ?? []).filter(
      (result) => result.status === "rejected",
    );
    const next = stateFrom(payload);
    if (next) {
      const pending = loadQueue().ops;
      const painted = paint(next, pending);
      saveState(painted);
      onState(painted);
    }
    if (rejected.length) {
      onError(
        `${rejected.length} change${rejected.length === 1 ? "" : "s"} could not sync.`,
      );
    } else {
      onError("");
    }
    return;
  }
  const response = await fetch("/api/state", { headers });
  if (response.status === 401) throw new Error("Sign in again to sync.");
  if (!response.ok) throw new Error(`Sync failed (${response.status}).`);
  const payload = (await response.json()) as NutritionState;
  const next = stateFrom(payload);
  if (!next) return;
  saveState(next);
  onState(next);
  onError("");
}

function after(iso: string): string {
  const time = new Date(iso).getTime();
  const base = Number.isNaN(time) ? Date.now() : time;
  return new Date(base + 1).toISOString();
}

export function backfillCreates(state: NutritionState): void {
  const queue = loadQueue();
  const created = new Set(
    queue.ops
      .filter((op) => op.type.endsWith(".create"))
      .map((op) => op.entityId),
  );
  const drafts: OpDraft[] = [];
  for (const entry of state.entries) {
    if (created.has(entry.id)) continue;
    drafts.push({
      type: "entry.create" as const,
      entityId: entry.id,
      occurredAt: entry.timestamp,
      count: false,
      body: {
        calories: entry.calories,
        eatenAt: entry.timestamp,
        mealId: entry.mealId,
        mealTitle: entry.mealTitle,
        mealDescription: entry.mealDescription,
      },
    });
    if (entry.removed) {
      drafts.push({
        type: "entry.remove" as const,
        entityId: entry.id,
        occurredAt: after(entry.timestamp),
        count: false,
      });
    }
  }
  for (const meal of state.meals) {
    if (created.has(meal.id)) continue;
    const occurredAt = new Date().toISOString();
    drafts.push({
      type: "meal.create" as const,
      entityId: meal.id,
      occurredAt,
      count: false,
      body: {
        title: meal.title,
        description: meal.description,
        calories: meal.calories,
      },
    });
    if (meal.removed) {
      drafts.push({
        type: "meal.remove" as const,
        entityId: meal.id,
        occurredAt: after(occurredAt),
        count: false,
      });
    }
  }
  for (const goal of state.goals) {
    if (created.has(goal.id)) continue;
    drafts.push({
      type: "goal.create" as const,
      entityId: goal.id,
      occurredAt: goal.setAt,
      count: false,
      body: { calories: goal.calories, setAt: goal.setAt },
    });
  }
  if (!drafts.length) return;
  enqueue(drafts);
}
