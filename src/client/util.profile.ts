const STORAGE_KEY = "nourish-display-name";

function readNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const names: Record<string, string> = {};
    for (const [sub, value] of Object.entries(parsed)) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (sub && trimmed) names[sub] = trimmed;
    }
    return names;
  } catch {
    return {};
  }
}

function writeNames(names: Record<string, string>): void {
  if (!Object.keys(names).length) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
}

/** Local display name for this Auth0 user, if they saved one on this device. */
export function localDisplayName(sub: string): string | undefined {
  if (!sub) return undefined;
  return readNames()[sub];
}

/** Saves a local override. An empty name, or one equal to the Auth0 display
 * name, clears the override and returns "". */
export function setLocalDisplayName(
  sub: string,
  name: string,
  authName: string,
): string {
  if (!sub) return "";
  const names = readNames();
  const trimmed = name.trim();
  if (!trimmed || trimmed === authName.trim()) delete names[sub];
  else names[sub] = trimmed;
  writeNames(names);
  return names[sub] ?? "";
}
