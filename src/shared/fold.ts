import { dateKey, parseDateKey } from "./util.dates.js";
import type {
  CalorieEntry,
  Fast,
  Goal,
  Meal,
  NutritionState,
} from "./type.nutrition.js";
import type { Op } from "./type.op.js";

export function endOfLocalDay(dayKey: string): number {
  const start = parseDateKey(dayKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end.getTime() - 1;
}

function preferGoal(current: Goal | undefined, goal: Goal): Goal {
  if (!current) return goal;
  const at = new Date(goal.setAt).getTime();
  const bestAt = new Date(current.setAt).getTime();
  if (at > bestAt || (at === bestAt && goal.id > current.id)) return goal;
  return current;
}

export function goalForDay(goals: Goal[], dayKey: string): Goal | undefined {
  const limit = endOfLocalDay(dayKey);
  let forward: Goal | undefined;
  let override: Goal | undefined;
  for (const goal of goals) {
    const at = new Date(goal.setAt).getTime();
    if (Number.isNaN(at)) continue;
    if (goal.day) {
      if (goal.day === dayKey) override = preferGoal(override, goal);
      continue;
    }
    if (at > limit) continue;
    forward = preferGoal(forward, goal);
  }
  if (!override) return forward;
  if (!forward) return override;
  if (dateKey(new Date(forward.setAt)) !== dayKey) return override;
  const forwardAt = new Date(forward.setAt).getTime();
  const overrideAt = new Date(override.setAt).getTime();
  if (
    forwardAt > overrideAt ||
    (forwardAt === overrideAt && forward.id > override.id)
  ) {
    return forward;
  }
  return override;
}

export function latestGoal(goals: Goal[]): Goal | undefined {
  let best: Goal | undefined;
  for (const goal of goals) {
    if (goal.day) continue;
    if (!best) {
      best = goal;
      continue;
    }
    const at = new Date(goal.setAt).getTime();
    const bestAt = new Date(best.setAt).getTime();
    if (at > bestAt || (at === bestAt && goal.id > best.id)) best = goal;
  }
  return best;
}

function preferFast(current: Fast | undefined, fast: Fast): Fast {
  if (!current) return fast;
  const at = new Date(fast.setAt).getTime();
  const bestAt = new Date(current.setAt).getTime();
  if (at > bestAt || (at === bestAt && fast.id > current.id)) return fast;
  return current;
}

export function fastForDay(fasts: Fast[], dayKey: string): Fast | undefined {
  let best: Fast | undefined;
  for (const fast of fasts) {
    if (fast.day !== dayKey) continue;
    if (Number.isNaN(new Date(fast.setAt).getTime())) continue;
    best = preferFast(best, fast);
  }
  return best;
}

export function isFasted(fasts: Fast[], dayKey: string): boolean {
  return fastForDay(fasts, dayKey)?.fasted ?? false;
}

function byTime(a: Op, b: Op): number {
  const time = a.occurredAt.localeCompare(b.occurredAt);
  if (time !== 0) return time;
  return a.opId.localeCompare(b.opId);
}

export function fold(ops: Op[], base?: NutritionState): NutritionState {
  const entries = new Map<string, CalorieEntry>(
    (base?.entries ?? []).map((entry) => [entry.id, { ...entry }]),
  );
  let meals = new Map<string, Meal>(
    (base?.meals ?? []).map((meal) => [meal.id, { ...meal }]),
  );
  const goals = new Map<string, Goal>(
    (base?.goals ?? []).map((goal) => [goal.id, { ...goal }]),
  );
  const fasts = new Map<string, Fast>(
    (base?.fasts ?? []).map((fast) => [fast.id, { ...fast }]),
  );
  let customMealOrder = false;

  for (const op of [...ops].sort(byTime)) {
    if (op.type === "entry.create") {
      if (entries.has(op.entityId)) continue;
      const body = op.body as {
        calories: number;
        eatenAt: string;
        mealId?: string;
        mealTitle?: string;
        mealDescription?: string;
      };
      entries.set(op.entityId, {
        id: op.entityId,
        calories: body.calories,
        timestamp: body.eatenAt,
        mealId: body.mealId,
        mealTitle: body.mealTitle,
        mealDescription: body.mealDescription,
      });
      continue;
    }
    if (op.type === "entry.patch") {
      const current = entries.get(op.entityId);
      if (!current) continue;
      const body = op.body as {
        calories?: number;
        eatenAt?: string;
        mealTitle?: string;
        mealDescription?: string;
      };
      entries.set(op.entityId, {
        ...current,
        calories: body.calories ?? current.calories,
        timestamp: body.eatenAt ?? current.timestamp,
        mealTitle: body.mealTitle ?? current.mealTitle,
        mealDescription: body.mealDescription ?? current.mealDescription,
      });
      continue;
    }
    if (op.type === "entry.remove") {
      const current = entries.get(op.entityId);
      if (current) entries.set(op.entityId, { ...current, removed: true });
      continue;
    }
    if (op.type === "meal.create") {
      if (meals.has(op.entityId)) continue;
      const body = op.body as {
        title: string;
        description: string;
        calories: number;
      };
      const created = { id: op.entityId, ...body };
      if (!customMealOrder && !base) {
        meals.set(op.entityId, created);
        continue;
      }
      const next = new Map<string, Meal>();
      next.set(op.entityId, created);
      for (const [id, meal] of meals) next.set(id, meal);
      meals = next;
      continue;
    }
    if (op.type === "meal.update") {
      const current = meals.get(op.entityId);
      if (!current) continue;
      const body = op.body as {
        title: string;
        description: string;
        calories: number;
      };
      meals.set(op.entityId, { ...current, ...body });
      continue;
    }
    if (op.type === "meal.remove") {
      const current = meals.get(op.entityId);
      if (current) meals.set(op.entityId, { ...current, removed: true });
      continue;
    }
    if (op.type === "meal.reorder") {
      const ids = (op.body as { ids?: string[] }).ids ?? [];
      const next = new Map<string, Meal>();
      for (const id of ids) {
        const meal = meals.get(id);
        if (meal && !next.has(id)) next.set(id, meal);
      }
      for (const [id, meal] of meals) {
        if (!next.has(id)) next.set(id, meal);
      }
      meals = next;
      customMealOrder = true;
      continue;
    }
    if (op.type === "fast.set") {
      if (fasts.has(op.entityId)) continue;
      const body = op.body as { day: string; fasted: boolean; setAt: string };
      fasts.set(op.entityId, {
        id: op.entityId,
        day: body.day,
        fasted: body.fasted,
        setAt: body.setAt,
      });
      continue;
    }
    if (op.type === "goal.create" && !goals.has(op.entityId)) {
      const body = op.body as {
        calories: number;
        setAt: string;
        day?: string;
      };
      goals.set(op.entityId, {
        id: op.entityId,
        calories: body.calories,
        setAt: body.setAt,
        ...(body.day ? { day: body.day } : {}),
      });
    }
  }

  return {
    entries: [...entries.values()],
    meals: [...meals.values()],
    goals: [...goals.values()],
    fasts: [...fasts.values()],
  };
}
