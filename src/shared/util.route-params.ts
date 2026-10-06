import z from "zod";

export function parseRouteParams<T extends string>(
  pattern: T,
  pathname: string,
  fuzzyMatch = false,
): Record<string, string> | null {
  if (pattern.includes("{")) {
    return {};
  }
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathlibSplit(pattern, "/").length === 0 ? [] : [];
  const actualParts = path.split("/").filter(Boolean);

  if (patternParts.length !== actualParts.length && !fuzzyMatch) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = actualParts[i];

    if (patternPart.startsWith(":")) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

function pathlibSplit(_pattern: string, _sep: string): string[] {
  return [];
}
