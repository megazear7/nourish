import { fold, isFasted } from "./fold.js";
import type { DayCall } from "./type.competition.js";
import type { Goal, NutritionState } from "./type.nutrition.js";
import type { Op } from "./type.op.js";
import { addDays } from "./util.dates.js";
import { clampTone, toneLabel } from "./util.score.js";
import {
  dateKeyInZone,
  dayLocked,
  lastDayOfMonth,
  zonedEndExclusive,
} from "./util.zone.js";

export type TimedOp = { op: Op; receivedAt: string };

export type ScoredPlayer = {
  email: string;
  timeZone: string;
  ops: TimedOp[];
};

export type PlayerStanding = {
  email: string;
  points: number | null;
  alive: boolean;
  knockedOutOn: string | null;
  today: DayCall | null;
  caloriesToday: number | null;
  /** Most logged calories that keep today On track. Null outside last one standing. */
  safeToday: number | null;
  /** Competition days reached in a row. Null outside last one standing. */
  streak: number | null;
  winner: boolean;
};

export type StandingBoard = {
  completed: boolean;
  winners: string[];
  players: PlayerStanding[];
};

const WINDOW: { daysAgo: number; weight: number }[] = [
  { daysAgo: 0, weight: 1 },
  { daysAgo: 1, weight: 1 / 2 },
  { daysAgo: 2, weight: 1 / 3 },
  { daysAgo: 3, weight: 1 / 4 },
  { daysAgo: 4, weight: 1 / 5 },
  { daysAgo: 5, weight: 1 / 6 },
  { daysAgo: 6, weight: 1 / 7 },
];

function dayTotal(
  state: NutritionState,
  day: string,
  timeZone: string,
): number {
  return state.entries
    .filter(
      (entry) =>
        !entry.removed &&
        dateKeyInZone(new Date(entry.timestamp), timeZone) === day,
    )
    .reduce((sum, entry) => sum + entry.calories, 0);
}

function loggedOn(
  state: NutritionState,
  day: string,
  timeZone: string,
): boolean {
  return state.entries.some(
    (entry) =>
      !entry.removed &&
      dateKeyInZone(new Date(entry.timestamp), timeZone) === day,
  );
}

function assumed(
  state: NutritionState,
  day: string,
  goal: number,
  timeZone: string,
): number {
  if (loggedOn(state, day, timeZone)) return dayTotal(state, day, timeZone);
  if (isFasted(state.fasts, day)) return 0;
  return goal;
}

export function goalInZone(
  goals: Goal[],
  day: string,
  timeZone: string,
): Goal | undefined {
  const limit = zonedEndExclusive(day, timeZone).getTime() - 1;
  let forward: Goal | undefined;
  let override: Goal | undefined;
  const prefer = (current: Goal | undefined, goal: Goal): Goal => {
    if (!current) return goal;
    const at = new Date(goal.setAt).getTime();
    const bestAt = new Date(current.setAt).getTime();
    if (at > bestAt || (at === bestAt && goal.id > current.id)) return goal;
    return current;
  };
  for (const goal of goals) {
    const at = new Date(goal.setAt).getTime();
    if (Number.isNaN(at)) continue;
    if (goal.day) {
      if (goal.day === day) override = prefer(override, goal);
      continue;
    }
    if (at > limit) continue;
    forward = prefer(forward, goal);
  }
  if (!override) return forward;
  if (!forward) return override;
  const forwardDay = dateKeyInZone(new Date(forward.setAt), timeZone);
  if (forwardDay !== day) return override;
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

function weighted(
  state: NutritionState,
  day: string,
  goal: number,
  timeZone: string,
): number {
  const sum = WINDOW.reduce((total, slot) => {
    const slotDay = addDays(day, -slot.daysAgo);
    const delta = assumed(state, slotDay, goal, timeZone) - goal;
    return total + delta * slot.weight;
  }, 0);
  return clampTone(dayTotal(state, day, timeZone), goal, sum);
}

export function foldAt(ops: TimedOp[], cutoff: Date): NutritionState {
  const limit = cutoff.getTime();
  const included = ops
    .filter((row) => new Date(row.receivedAt).getTime() < limit)
    .map((row) => row.op);
  return fold(included);
}

export function dayCall(
  state: NutritionState,
  day: string,
  timeZone: string,
): DayCall {
  const goal = goalInZone(state.goals, day, timeZone);
  if (!goal || !(goal.calories > 0)) return "miss";
  const fasted = isFasted(state.fasts, day);
  if (!loggedOn(state, day, timeZone) && !fasted) return "miss";
  const label = toneLabel(weighted(state, day, goal.calories, timeZone));
  if (label === "On track") return "on-track";
  if (label === "Drifting") return "drifting";
  if (label === "Running hot") return "running-hot";
  return "over";
}

export function pointsFor(call: DayCall): number {
  if (call === "on-track") return 1;
  if (call === "drifting") return 0;
  return -1;
}

export function knocksOut(call: DayCall): boolean {
  return call !== "on-track";
}

function daysThrough(start: string, end: string): string[] {
  const days: string[] = [];
  let day = start;
  while (day <= end && days.length < 400) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

function callAt(player: ScoredPlayer, day: string, cutoff: Date): DayCall {
  return dayCall(foldAt(player.ops, cutoff), day, player.timeZone);
}

function provisionalToday(
  player: ScoredPlayer,
  startDay: string,
  monthEnd: string | null,
  now: Date,
): DayCall | null {
  const today = dateKeyInZone(now, player.timeZone);
  if (today < startDay) return null;
  if (monthEnd && today > monthEnd) return null;
  if (dayLocked(today, player.timeZone, now)) return null;
  const state = fold(player.ops.map((row) => row.op));
  return dayCall(state, today, player.timeZone);
}

/** Logged calories on the player's open local day. Not the weighted score. */
function openCalories(
  player: ScoredPlayer,
  startDay: string,
  monthEnd: string | null,
  now: Date,
): number | null {
  const today = openDay(player, startDay, monthEnd, now);
  if (!today) return null;
  const state = fold(player.ops.map((row) => row.op));
  return Math.round(dayTotal(state, today, player.timeZone));
}

const PRIOR_SCALE = 420;

/** Highest integer log that still scores On track today. The one-third hold
 * keeps a day green even when earlier days were far over. */
function safeCalories(
  state: NutritionState,
  day: string,
  timeZone: string,
): number | null {
  const goal = goalInZone(state.goals, day, timeZone);
  if (!goal || !(goal.calories > 0)) return null;
  let prior = 0;
  for (let daysAgo = 1; daysAgo <= 6; daysAgo += 1) {
    const delta =
      assumed(state, addDays(day, -daysAgo), goal.calories, timeZone) -
      goal.calories;
    prior += delta * (PRIOR_SCALE / (daysAgo + 1));
  }
  const raw = Math.floor((goal.calories * PRIOR_SCALE - prior) / PRIOR_SCALE);
  const underThird = Math.floor((goal.calories - 1) / 3);
  return Math.max(raw, underThird, 0);
}

function openSafe(
  player: ScoredPlayer,
  startDay: string,
  monthEnd: string | null,
  now: Date,
): number | null {
  const today = openDay(player, startDay, monthEnd, now);
  if (!today) return null;
  const state = fold(player.ops.map((row) => row.op));
  return safeCalories(state, today, player.timeZone);
}

function openDay(
  player: ScoredPlayer,
  startDay: string,
  monthEnd: string | null,
  now: Date,
): string | null {
  const today = dateKeyInZone(now, player.timeZone);
  if (today < startDay) return null;
  if (monthEnd && today > monthEnd) return null;
  return today;
}

export function scoreCompetition(input: {
  kind: "last_one_standing" | "best_of_month";
  startDay: string;
  monthEnd: string | null;
  players: ScoredPlayer[];
  now: Date;
}): StandingBoard {
  const players = input.players;
  if (input.kind === "best_of_month") {
    return scoreMonth(input.startDay, input.monthEnd, players, input.now);
  }
  return scoreLastStanding(input.startDay, players, input.now);
}

function scoreMonth(
  startDay: string,
  monthEnd: string | null,
  players: ScoredPlayer[],
  now: Date,
): StandingBoard {
  const end = monthEnd ?? lastDayOfMonth(startDay);
  const completed =
    players.length > 0 &&
    players.every((player) => dayLocked(end, player.timeZone, now));
  const rows = players.map((player) => {
    let points = 0;
    for (const day of daysThrough(startDay, end)) {
      if (!dayLocked(day, player.timeZone, now)) break;
      const cutoff = zonedEndExclusive(day, player.timeZone);
      points += pointsFor(callAt(player, day, cutoff));
    }
    const row: PlayerStanding = {
      email: player.email,
      points,
      alive: true,
      knockedOutOn: null,
      today: provisionalToday(player, startDay, end, now),
      caloriesToday: completed
        ? null
        : openCalories(player, startDay, end, now),
      safeToday: null,
      streak: null,
      winner: false,
    };
    return row;
  });
  let winners: string[] = [];
  if (completed && rows.length) {
    const best = Math.max(...rows.map((row) => row.points ?? 0));
    winners = rows.filter((row) => row.points === best).map((row) => row.email);
    for (const row of rows) row.winner = winners.includes(row.email);
  }
  return { completed, winners, players: rows };
}

function scoreLastStanding(
  startDay: string,
  players: ScoredPlayer[],
  now: Date,
): StandingBoard {
  const knocked = new Map<string, string>();
  let alive = players.slice();
  let day = startDay;
  let winners: string[] = [];
  let completed = false;
  let resolvedDay: string | null = null;

  for (let step = 0; step < 400 && alive.length > 1; step += 1) {
    const pending = alive.filter(
      (player) => !dayLocked(day, player.timeZone, now),
    );
    if (pending.length) break;
    const out = alive.filter((player) =>
      knocksOut(callAt(player, day, zonedEndExclusive(day, player.timeZone))),
    );
    if (out.length === alive.length) {
      winners = alive.map((player) => player.email);
      for (const player of alive) knocked.set(player.email, day);
      resolvedDay = day;
      completed = true;
      alive = [];
      break;
    }
    for (const player of out) knocked.set(player.email, day);
    alive = alive.filter((player) => !knocked.has(player.email));
    if (alive.length === 1) {
      const winner = alive[0];
      if (winner) winners = [winner.email];
      resolvedDay = day;
      completed = true;
      break;
    }
    day = addDays(day, 1);
  }

  return {
    completed,
    winners,
    players: players.map((player) => {
      const knockedOutOn = knocked.get(player.email) ?? null;
      const winner = winners.includes(player.email);
      const stillIn = !knockedOutOn;
      return {
        email: player.email,
        points: null,
        alive: stillIn,
        knockedOutOn,
        today: provisionalToday(player, startDay, null, now),
        caloriesToday: completed
          ? null
          : openCalories(player, startDay, null, now),
        safeToday: completed ? null : openSafe(player, startDay, null, now),
        streak: standingStreak(
          startDay,
          knockedOutOn,
          stillIn,
          winner,
          completed,
          resolvedDay,
          dateKeyInZone(now, player.timeZone),
        ),
        winner,
      };
    }),
  };
}

function inclusiveDays(start: string, end: string): number {
  if (end < start) return 0;
  return daysThrough(start, end).length;
}

function standingStreak(
  startDay: string,
  knockedOutOn: string | null,
  alive: boolean,
  winner: boolean,
  completed: boolean,
  resolvedDay: string | null,
  today: string,
): number {
  if (completed && winner && resolvedDay) {
    return inclusiveDays(startDay, resolvedDay);
  }
  if (knockedOutOn) return inclusiveDays(startDay, addDays(knockedOutOn, -1));
  if (alive) return inclusiveDays(startDay, today);
  return 0;
}

export function hasPositiveGoal(
  goals: Goal[],
  day: string,
  timeZone: string,
): boolean {
  const goal = goalInZone(goals, day, timeZone);
  return Boolean(goal && goal.calories > 0);
}
