import { acceptOps, type OwnedOp } from "../shared/apply.js";
import type { NutritionState } from "../shared/type.nutrition.js";
import { emptyState } from "../shared/type.nutrition.js";
import type { Op, OpResult } from "../shared/type.op.js";

export type SyncOutcome = {
  results: OpResult[];
  state: NutritionState;
};

export interface NourishStore {
  sync(
    userId: string,
    email: string | null,
    deviceId: string | null,
    incoming: unknown[],
  ): Promise<SyncOutcome>;
  read(userId: string, email: string | null): Promise<NutritionState>;
}

export type Persisted = {
  users: { userId: string; email: string | null }[];
  ops: OwnedOp[];
  owners: { entityId: string; userId: string }[];
};

export function applyPersisted(
  data: Persisted,
  userId: string,
  email: string | null,
  incoming: unknown[],
): { data: Persisted; outcome: SyncOutcome } {
  if (!data.users.some((user) => user.userId === userId)) {
    data.users.push({ userId, email });
  } else if (email) {
    const user = data.users.find((item) => item.userId === userId);
    if (user) user.email = email;
  }
  const outcome = acceptOps({
    userId,
    incoming,
    existing: data.ops,
    entityOwners: data.owners,
  });
  for (const op of outcome.accepted) data.ops.push({ userId, op });
  const ids = new Set<string>();
  for (const entry of outcome.state.entries) ids.add(entry.id);
  for (const meal of outcome.state.meals) ids.add(meal.id);
  for (const goal of outcome.state.goals) ids.add(goal.id);
  data.owners = [
    ...data.owners.filter((owner) => owner.userId !== userId),
    ...[...ids].map((entityId) => ({ entityId, userId })),
  ];
  return { data, outcome: { results: outcome.results, state: outcome.state } };
}

export function readPersisted(data: Persisted, userId: string): NutritionState {
  const ops = data.ops
    .filter((row) => row.userId === userId)
    .map((row) => row.op);
  if (!ops.length) return emptyState();
  return acceptOps({
    userId,
    incoming: [],
    existing: data.ops.filter((row) => row.userId === userId),
    entityOwners: [],
  }).state;
}

export function blankPersisted(): Persisted {
  return { users: [], ops: [], owners: [] };
}

export type { Op };
