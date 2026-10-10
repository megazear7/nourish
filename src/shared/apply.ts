import { fold } from "./fold.js";
import type { NutritionState } from "./type.nutrition.js";
import { Op, type OpResult } from "./type.op.js";

export type OwnedOp = { userId: string; op: Op };

export function acceptOps(input: {
  userId: string;
  incoming: unknown[];
  existing: OwnedOp[];
  entityOwners: { entityId: string; userId: string }[];
}): { results: OpResult[]; accepted: Op[]; state: NutritionState } {
  const seen = new Map(input.existing.map((row) => [row.op.opId, row.userId]));
  const owners = new Map(
    input.entityOwners.map((row) => [row.entityId, row.userId]),
  );
  const accepted: Op[] = [];
  const results: OpResult[] = [];

  for (const raw of input.incoming) {
    const opId = readOpId(raw);
    const parsed = Op.safeParse(raw);
    if (!parsed.success) {
      results.push({
        opId,
        status: "rejected",
        reason: parsed.error.issues[0]?.message ?? "invalid",
      });
      continue;
    }
    const op = parsed.data;
    const current = seen.get(op.opId);
    if (current === input.userId) {
      results.push({ opId: op.opId, status: "duplicate" });
      continue;
    }
    if (current && current !== input.userId) {
      results.push({ opId: op.opId, status: "rejected", reason: "conflict" });
      continue;
    }
    const owner = owners.get(op.entityId);
    if (owner && owner !== input.userId) {
      results.push({ opId: op.opId, status: "rejected", reason: "conflict" });
      continue;
    }
    accepted.push(op);
    seen.set(op.opId, input.userId);
    owners.set(op.entityId, input.userId);
    results.push({ opId: op.opId, status: "applied" });
  }

  const mine = input.existing
    .filter((row) => row.userId === input.userId)
    .map((row) => row.op);
  return { results, accepted, state: fold([...mine, ...accepted]) };
}

function readOpId(raw: unknown): string {
  if (!raw || typeof raw !== "object" || !("opId" in raw)) return "";
  const opId = raw.opId;
  return typeof opId === "string" ? opId : "";
}
