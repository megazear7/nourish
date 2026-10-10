import { dateKey, todayKey } from "../shared/util.dates.js";
import {
  emptyState,
  normalizeState,
  type NutritionState,
} from "../shared/type.nutrition.js";

const STORAGE_KEY = "nourish-state";

export { dateKey, todayKey };

export function entryDate(timestamp: string): string {
  return dateKey(new Date(timestamp));
}

export function loadState(): NutritionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const normalized = normalizeState(JSON.parse(raw), () => ({
      id: crypto.randomUUID(),
      setAt: new Date().toISOString(),
    }));
    if (!normalized) return emptyState();
    if (normalized.migrated) saveState(normalized.state);
    return normalized.state;
  } catch {
    return emptyState();
  }
}

export function saveState(state: NutritionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
