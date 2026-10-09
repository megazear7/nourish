import z from "zod";

export const CalorieEntry = z.object({
  id: z.string(),
  calories: z.number().int().positive(),
  timestamp: z.string(),
  mealId: z.string().optional(),
  mealTitle: z.string().optional(),
  mealDescription: z.string().optional(),
  removed: z.boolean().optional(),
});
export type CalorieEntry = z.infer<typeof CalorieEntry>;

export const Meal = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  calories: z.number().int().nonnegative(),
  removed: z.boolean().optional(),
});
export type Meal = z.infer<typeof Meal>;

export const DailyGoal = z.object({
  calories: z.number().int().positive(),
});
export type DailyGoal = z.infer<typeof DailyGoal>;

export const Goal = z.object({
  id: z.string().min(1),
  calories: z.number().int().positive(),
  setAt: z.string().min(1),
});
export type Goal = z.infer<typeof Goal>;

export const DaySummary = z.object({
  date: z.string(),
  totalCalories: z.number().int().nonnegative(),
  goal: z.number().int().positive().optional(),
});
export type DaySummary = z.infer<typeof DaySummary>;

export const NutritionState = z.object({
  entries: z.array(CalorieEntry),
  meals: z.array(Meal),
  goals: z.array(Goal),
});
export type NutritionState = z.infer<typeof NutritionState>;

const StoredDocument = z.object({
  entries: z.array(CalorieEntry).optional(),
  meals: z.array(Meal).optional(),
  goals: z.array(Goal).optional(),
  goal: DailyGoal.optional(),
});

export const emptyState = (): NutritionState => ({
  entries: [],
  meals: [],
  goals: [],
});

export function normalizeState(
  raw: unknown,
  migrate: () => { id: string; setAt: string },
): { state: NutritionState; migrated: boolean } | null {
  const parsed = StoredDocument.safeParse(raw);
  if (!parsed.success) return null;
  const goals = parsed.data.goals ? [...parsed.data.goals] : [];
  let migrated = false;
  if (!parsed.data.goals && parsed.data.goal) {
    const next = migrate();
    goals.push({
      id: next.id,
      calories: parsed.data.goal.calories,
      setAt: next.setAt,
    });
    migrated = true;
  }
  return {
    state: {
      entries: parsed.data.entries ?? [],
      meals: parsed.data.meals ?? [],
      goals,
    },
    migrated: migrated || parsed.data.goal !== undefined,
  };
}
