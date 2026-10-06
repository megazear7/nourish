import { NutritionState, NutritionStateSchema } from "../shared/type.nutrition.js";

const STORAGE_KEY = "nourish-state";

const emptyState: NutritionState = {
  entries: [],
  meals: [],
  goal: undefined,
};

export function loadState(): NutritionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw);
    const result = NutritionStateSchema.safeParse(parsed);
    return result.success ? result.data : emptyState;
  } catch {
    return emptyState;
  }
}

export function saveState(state: NutritionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
