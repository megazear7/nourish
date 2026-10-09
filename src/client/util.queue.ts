import type { OpType } from "../shared/type.op.js";

const QUEUE_KEY = "nourish-queue";

export type QueuedOp = {
  opId: string;
  type: OpType;
  entityId: string;
  occurredAt: string;
  body: Record<string, unknown>;
  count: boolean;
};

export type Queue = {
  deviceId: string;
  syncedUserId: string | null;
  ops: QueuedOp[];
};

export type OpDraft = {
  type: OpType;
  entityId: string;
  body?: Record<string, unknown>;
  occurredAt?: string;
  count?: boolean;
};

function emptyQueue(): Queue {
  return {
    deviceId: crypto.randomUUID(),
    syncedUserId: null,
    ops: [],
  };
}

export function loadQueue(): Queue {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return emptyQueue();
    const parsed = JSON.parse(raw) as Partial<Queue>;
    if (!parsed || typeof parsed.deviceId !== "string") return emptyQueue();
    return {
      deviceId: parsed.deviceId,
      syncedUserId:
        typeof parsed.syncedUserId === "string" ? parsed.syncedUserId : null,
      ops: Array.isArray(parsed.ops) ? parsed.ops : [],
    };
  } catch {
    return emptyQueue();
  }
}

export function saveQueue(queue: Queue): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(drafts: OpDraft[]): QueuedOp[] {
  const queue = loadQueue();
  const created = drafts.map((draft) => ({
    opId: crypto.randomUUID(),
    type: draft.type,
    entityId: draft.entityId,
    occurredAt: draft.occurredAt ?? new Date().toISOString(),
    body: draft.body ?? {},
    count: draft.count !== false,
  }));
  queue.ops.push(...created);
  saveQueue(queue);
  return created;
}

export function markSyncedUser(userId: string): void {
  const queue = loadQueue();
  queue.syncedUserId = userId;
  saveQueue(queue);
}

export function dropOps(opIds: string[]): void {
  const drop = new Set(opIds);
  const queue = loadQueue();
  queue.ops = queue.ops.filter((op) => !drop.has(op.opId));
  saveQueue(queue);
}

const STASH_PREFIX = "nourish-account:";

export function stashAccount(userId: string, stateJson: string): void {
  const queue = loadQueue();
  localStorage.setItem(
    STASH_PREFIX + userId,
    JSON.stringify({ state: JSON.parse(stateJson), queue }),
  );
}

export function restoreAccount(userId: string): boolean {
  const raw = localStorage.getItem(STASH_PREFIX + userId);
  if (!raw) return false;
  const parsed = JSON.parse(raw) as { state: unknown; queue: Queue };
  localStorage.setItem("nourish-state", JSON.stringify(parsed.state));
  const deviceId = loadQueue().deviceId;
  saveQueue({ ...parsed.queue, deviceId });
  return true;
}

export function resetOpenDocument(deviceId: string): void {
  localStorage.setItem(
    "nourish-state",
    JSON.stringify({ entries: [], meals: [], goals: [] }),
  );
  saveQueue({ deviceId, syncedUserId: null, ops: [] });
}
