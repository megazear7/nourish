export function parseRouteParams<T extends string>(
  pattern: T,
  pathlib: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathlib.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

export function renderPathname(
  pattern: string,
  params: Record<string, string | number>,
): string {
  let pathlib = pattern;
  for (const [key, value] of Object.entries(params)) {
    pathlib = pathlib.replace(`:${key}`, String(value));
  }
  return pathlib;
}
