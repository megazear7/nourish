import { parseDateKey } from "./util.dates.js";
import type {
  CalorieEntry,
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

export function goalForDay(goals: Goal[], dayKey: string): Goal | undefined {
  const limit = endOfLocalDay(dayKey);
  let best: Goal | undefined;
  for (const goal of goals) {
    const at = new Date(goal.setAt).getTime();
    if (Number.isNaN(at) || at > limit) continue;
    if (!best) {
      best = goal;
      continue;
    }
    const bestAt = new Date(best.setAt).getTime();
    if (at > bestAt || (at === bestAt && goal.id > best.id)) best = goal;
  }
  return best;
}

export function latestGoal(goals: Goal[]): Goal | undefined {
  let best: Goal | undefined;
  for (const goal of goals) {
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

function byTime(a: Op, b: Op): number {
  const time = a.occurredAt.localeCompare(b.occurredAt);
  if (time !== 0) return time;
  return a.opId.localeCompare(b.opId);
}

export function fold(ops: Op[], base?: NutritionState): NutritionState {
  const entries = new Map<string, CalorieEntry>(
    (base?.entries ?? []).map((entry) => [entry.id, { ...entry }]),
  );
  const meals = new Map<string, Meal>(
    (base?.meals ?? []).map((meal) => [meal.id, { ...meal }]),
  );
  const goals = new Map<string, Goal>(
    (base?.goals ?? []).map((goal) => [goal.id, { ...goal }]),
  );

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
      meals.set(op.entityId, { id: op.entityId, ...body });
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
    if (op.type === "goal.create" && !goals.has(op.entityId)) {
      const body = op.body as { calories: number; setAt: string };
      goals.set(op.entityId, {
        id: op.entityId,
        calories: body.calories,
        setAt: body.setAt,
      });
    }
  }

  return {
    entries: [...entries.values()],
    meals: [...meals.values()],
    goals: [...goals.values()],
  };
}
