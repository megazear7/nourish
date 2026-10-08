import z from "zod";

export const CalorieEntry = z.object({
  id: z.string(),
  calories: z.number().int().positive(),
  timestamp: z.string(),
  mealId: z.string().optional(),
  mealTitle: z.string().optional(),
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

export const DaySummary = z.object({
  date: z.string(),
  totalCalories: z.number().int().nonnegative(),
  goal: z.number().int().positive().optional(),
});
export type DaySummary = z.infer<typeof DaySummary>;

export const NutritionState = z.object({
  entries: z.array(CalorieEntry),
  meals: z.array(Meal),
  goal: DailyGoal.optional(),
});
export type NutritionState = z.infer<typeof NutritionState>;
