import { latestGoal } from "../shared/fold.js";
import type { NutritionState } from "../shared/type.nutrition.js";
import type { QueuedOp } from "./util.queue.js";
import { UserDataClient } from "./identity-client.js";

const ACTIVITY_KEY = "nourish-activity";

export type ActivityDoc = {
  loginCount: number;
  lastLoginAt: string | null;
  mealsCreated: number;
  entriesCreated: number;
  goalUpdates: number;
  currentGoal: number | null;
  updatedAt: string;
};

function emptyActivity(now = new Date().toISOString()): ActivityDoc {
  return {
    loginCount: 0,
    lastLoginAt: null,
    mealsCreated: 0,
    entriesCreated: 0,
    goalUpdates: 0,
    currentGoal: null,
    updatedAt: now,
  };
}

export function loadActivity(): ActivityDoc {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return emptyActivity();
    const parsed = JSON.parse(raw) as Partial<ActivityDoc>;
    return { ...emptyActivity(), ...parsed };
  } catch {
    return emptyActivity();
  }
}

function saveActivity(doc: ActivityDoc): void {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(doc));
}

export function recordOps(ops: QueuedOp[], state: NutritionState): void {
  const doc = loadActivity();
  let changed = false;
  for (const op of ops) {
    if (!op.count) continue;
    if (op.type === "entry.create") {
      doc.entriesCreated += 1;
      changed = true;
    } else if (op.type === "meal.create") {
      doc.mealsCreated += 1;
      changed = true;
    } else if (op.type === "goal.create") {
      doc.goalUpdates += 1;
      changed = true;
    }
  }
  const goal = latestGoal(state.goals);
  const current = goal?.calories ?? null;
  if (current !== doc.currentGoal) {
    doc.currentGoal = current;
    changed = true;
  }
  if (!changed) return;
  doc.updatedAt = new Date().toISOString();
  saveActivity(doc);
}

export function recordLogin(): void {
  const doc = loadActivity();
  doc.loginCount += 1;
  doc.lastLoginAt = new Date().toISOString();
  doc.updatedAt = doc.lastLoginAt;
  saveActivity(doc);
}

export async function pushActivity(
  client: UserDataClient,
  deviceId: string,
): Promise<void> {
  const doc = loadActivity();
  await client.put({
    app: "nourish",
    visibility: "private",
    path: `activity/${deviceId}`,
    data: doc,
  });
}
