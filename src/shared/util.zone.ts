import { addDays } from "./util.dates.js";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: string): boolean {
  return DAY_KEY.test(value);
}

export function isTimeZone(value: string): boolean {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

type Civil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function civilInZone(instant: Date, timeZone: string): Civil {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const hour = num("hour");
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: hour === 24 ? 0 : hour,
    minute: num("minute"),
    second: num("second"),
  };
}

export function dateKeyInZone(instant: Date, timeZone: string): string {
  const civil = civilInZone(instant, timeZone);
  const month = String(civil.month).padStart(2, "0");
  const day = String(civil.day).padStart(2, "0");
  return `${civil.year}-${month}-${day}`;
}

/** 00:00:00 on `dayKey` in `timeZone`, as a UTC instant. */
export function zonedStart(dayKey: string, timeZone: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  const want = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, 0, 0);
  let utc = want;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const got = civilInZone(new Date(utc), timeZone);
    const gotUtc = Date.UTC(
      got.year,
      got.month - 1,
      got.day,
      got.hour,
      got.minute,
      got.second,
    );
    const delta = want - gotUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

/** The instant the next local day begins. A day is locked at this instant. */
export function zonedEndExclusive(dayKey: string, timeZone: string): Date {
  return zonedStart(addDays(dayKey, 1), timeZone);
}

export function lastDayOfMonth(dayKey: string): string {
  const [year, month] = dayKey.split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 1970, month ?? 1, 0));
  const y = last.getUTCFullYear();
  const m = String(last.getUTCMonth() + 1).padStart(2, "0");
  const d = String(last.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dayLocked(
  dayKey: string,
  timeZone: string,
  now: Date,
): boolean {
  return now.getTime() >= zonedEndExclusive(dayKey, timeZone).getTime();
}
