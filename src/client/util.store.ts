import {
  CalorieEntry,
  Meal,
  NutritionState,
} from "../shared/type.nutrition.js";
import { entryDate, loadState, saveState, todayKey } from "./util.storage.js";

type Listener = () => void;

let state: NutritionState = loadState();
const listeners = new Set<Listener>();

export function getState(): NutritionState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: NutritionState): void {
  state = next;
  saveState(state);
  listeners.forEach((listener) => listener());
}

export function setGoal(calories: number): void {
  const goal = {
    id: crypto.randomUUID(),
    calories,
    setAt: new Date().toISOString(),
  };
  commit({ ...state, goals: [...state.goals, goal] });
}

export function addEntry(calories: number, mealId?: string): void {
  const entry: CalorieEntry = {
    id: crypto.randomUUID(),
    calories,
    timestamp: new Date().toISOString(),
    mealId,
  };
  commit({ ...state, entries: [entry, ...state.entries] });
}

export function removeEntry(id: string): void {
  commit({
    ...state,
    entries: state.entries.filter((entry) => entry.id !== id),
  });
}

export function upsertMeal(input: {
  id?: string;
  title: string;
  description: string;
  calories: number;
}): Meal {
  const meal: Meal = {
    id: input.id ?? crypto.randomUUID(),
    title: input.title,
    description: input.description,
    calories: input.calories,
  };
  const exists = state.meals.some((item) => item.id === meal.id);
  const meals = exists
    ? state.meals.map((item) => (item.id === meal.id ? meal : item))
    : [meal, ...state.meals];
  commit({ ...state, meals });
  return meal;
}

export function removeMeal(id: string): void {
  commit({ ...state, meals: state.meals.filter((meal) => meal.id !== id) });
}

export function caloriesOn(date: string): number {
  return state.entries
    .filter((entry) => entryDate(entry.timestamp) === date)
    .reduce((sum, entry) => sum + entry.calories, 0);
}

export function entriesOn(date: string): CalorieEntry[] {
  return state.entries.filter((entry) => entryDate(entry.timestamp) === date);
}

export function todayCalories(): number {
  return caloriesOn(todayKey());
}
