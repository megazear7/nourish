import { createAuth0Client, type Auth0Client } from "@auth0/auth0-spa-js";

declare const __NOURISH_AUTH0_DOMAIN__: string;
declare const __NOURISH_AUTH0_CLIENT_ID__: string;
declare const __NOURISH_AUTH0_AUDIENCE__: string;
declare const __NOURISH_IDENTITY_URL__: string;

export type AccountStatus =
  "checking" | "signed-out" | "signed-in" | "unconfigured";

export type Account = {
  status: AccountStatus;
  sub: string;
  name: string;
  email: string;
  picture: string;
};

export const signedOut = (): Account => ({
  status: "signed-out",
  sub: "",
  name: "",
  email: "",
  picture: "",
});

const AUTH_SCOPE = "openid profile email";

let client: Auth0Client | null = null;

export function authConfig() {
  return {
    domain: __NOURISH_AUTH0_DOMAIN__
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, ""),
    clientId: __NOURISH_AUTH0_CLIENT_ID__,
    audience: __NOURISH_AUTH0_AUDIENCE__ || "https://identity.megazear7.com",
    identityUrl:
      __NOURISH_IDENTITY_URL__ || "https://identity.megazear7.com/data",
  };
}

export function authConfigured(): boolean {
  const config = authConfig();
  return Boolean(config.domain && config.clientId);
}

export function displayName(profile: {
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  email?: string;
}): string {
  const email = (profile.email ?? "").trim();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const combined = [profile.given_name, profile.family_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const candidates: { value: string | undefined; rejectLocal: boolean }[] = [
    { value: profile.name, rejectLocal: false },
    { value: combined, rejectLocal: false },
    { value: profile.nickname, rejectLocal: true },
  ];
  for (const candidate of candidates) {
    const value = (candidate.value ?? "").trim();
    if (!value) continue;
    const folded = value.toLowerCase();
    if (email && folded === email.toLowerCase()) continue;
    if (candidate.rejectLocal && local && folded === local) continue;
    return value;
  }
  return "";
}

function accountFromUser(user: {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  email?: string;
  picture?: string;
}): Account {
  return {
    status: "signed-in",
    sub: user.sub ?? "",
    name: displayName(user),
    email: user.email ?? "",
    picture: user.picture ?? "",
  };
}

export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://") || /\s/.test(value)) {
    return null;
  }
  if (value.length > 200) return null;
  return value;
}

export async function initAuth(
  onLogin: () => void,
): Promise<{ account: Account; returnTo: string | null }> {
  if (!authConfigured()) {
    return {
      account: { ...signedOut(), status: "unconfigured" },
      returnTo: null,
    };
  }
  client = await createAuth0Client({
    domain: authConfig().domain,
    clientId: authConfig().clientId,
    cacheLocation: "localstorage",
    useRefreshTokens: true,
    useRefreshTokensFallback: true,
    authorizationParams: {
      audience: authConfig().audience,
      redirect_uri: window.location.origin,
      scope: AUTH_SCOPE,
    },
  });
  const params = new URLSearchParams(window.location.search);
  let returnTo: string | null = null;
  if (params.has("code") && params.has("state")) {
    const result = await client.handleRedirectCallback<{
      returnTo?: unknown;
    }>();
    returnTo = safeReturnPath(result?.appState?.returnTo);
    const clean = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", clean);
    onLogin();
  }
  if (!(await client.isAuthenticated())) {
    return { account: signedOut(), returnTo };
  }
  const user = await client.getUser();
  return {
    account: user?.sub ? accountFromUser(user) : signedOut(),
    returnTo,
  };
}

export async function login(signup: boolean): Promise<void> {
  if (!client) return;
  const returnTo = safeReturnPath(window.location.pathname);
  await client.loginWithRedirect({
    appState: returnTo ? { returnTo } : undefined,
    authorizationParams: {
      audience: authConfig().audience,
      redirect_uri: window.location.origin,
      scope: AUTH_SCOPE,
      ...(signup ? { screen_hint: "signup" } : {}),
    },
  });
}

export async function logout(): Promise<void> {
  if (!client) return;
  await client.logout({ logoutParams: { returnTo: window.location.origin } });
}

const reauthErrors = new Set([
  "login_required",
  "missing_refresh_token",
  "invalid_grant",
]);

function reauthError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("error" in error)) return false;
  const code = (error as { error?: unknown }).error;
  return typeof code === "string" && reauthErrors.has(code);
}

export async function accessToken(): Promise<string | null> {
  if (!client) return null;
  try {
    return (await client.getTokenSilently()) ?? null;
  } catch (error) {
    if (reauthError(error)) return null;
    throw error;
  }
}

function idTokenStillValid(raw: string): boolean {
  const part = raw.split(".")[1];
  if (!part) return false;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: unknown };
    return (
      typeof payload.exp !== "number" ||
      payload.exp * 1000 > Date.now() + 60_000
    );
  } catch {
    return false;
  }
}

export async function idToken(): Promise<string | null> {
  if (!client) return null;
  const claims = await client.getIdTokenClaims();
  const cached = claims?.__raw ?? null;
  if (cached && idTokenStillValid(cached) && claims?.email?.trim())
    return cached;
  try {
    const fresh = await client.getTokenSilently({
      cacheMode: "off",
      detailedResponse: true,
      authorizationParams: {
        audience: authConfig().audience,
        scope: AUTH_SCOPE,
      },
    });
    return (
      fresh?.id_token ?? (cached && idTokenStillValid(cached) ? cached : null)
    );
  } catch (error) {
    if (reauthError(error)) return null;
    return cached && idTokenStillValid(cached) ? cached : null;
  }
}
