export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return dateKey(now);
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function formatDayLabel(key: string, today = todayKey()): string {
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeValue(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function withTime(timestamp: string, time: string): string {
  const date = new Date(timestamp);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}
