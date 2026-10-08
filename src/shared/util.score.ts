import { CalorieEntry } from "./type.nutrition.js";
import { addDays, dateKey } from "./util.dates.js";

export const YELLOW_OVER = 150;
export const RED_OVER = 300;

const WINDOW: { daysAgo: number; weight: number }[] = [
  { daysAgo: 0, weight: 1 },
  { daysAgo: 1, weight: 1 / 2 },
  { daysAgo: 2, weight: 1 / 3 },
  { daysAgo: 3, weight: 1 / 4 },
  { daysAgo: 4, weight: 1 / 5 },
  { daysAgo: 5, weight: 1 / 6 },
  { daysAgo: 6, weight: 1 / 7 },
];

export function dayTotal(entries: CalorieEntry[], day: string): number {
  return entries
    .filter((entry) => !entry.removed && dateKey(new Date(entry.timestamp)) === day)
    .reduce((sum, entry) => sum + entry.calories, 0);
}

export function weightedOver(entries: CalorieEntry[], day: string, goal: number): number {
  return WINDOW.reduce((sum, slot) => {
    const slotDay = addDays(day, -slot.daysAgo);
    const delta = dayTotal(entries, slotDay) - goal;
    return sum + delta * slot.weight;
  }, 0);
}

export function toneColor(weighted: number): string {
  if (weighted <= 0) return "rgb(111, 191, 132)";
  if (weighted >= RED_OVER) return "rgb(214, 84, 78)";
  if (weighted <= YELLOW_OVER) {
    return mix("rgb(111, 191, 132)", "rgb(224, 184, 74)", weighted / YELLOW_OVER);
  }
  const progress = (weighted - YELLOW_OVER) / (RED_OVER - YELLOW_OVER);
  return mix("rgb(224, 184, 74)", "rgb(214, 84, 78)", progress);
}

function mix(from: string, to: string, amount: number): string {
  const start = parse(from);
  const end = parse(to);
  const clamped = Math.min(1, Math.max(0, amount));
  const channel = (index: number) =>
    Math.round(start[index] + (end[index] - start[index]) * clamped);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function parse(color: string): [number, number, number] {
  const matches = color.match(/\d+/g) ?? ["0", "0", "0"];
  return [Number(matches[0]), Number(matches[1]), Number(matches[2])];
}

export function toneLabel(weighted: number): string {
  if (weighted <= 0) return "On track";
  if (weighted < YELLOW_OVER) return "Drifting";
  if (weighted < RED_OVER) return "Running hot";
  return "Over the window";
}
