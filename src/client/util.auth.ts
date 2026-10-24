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

export async function initAuth(onLogin: () => void): Promise<Account> {
  if (!authConfigured()) return { ...signedOut(), status: "unconfigured" };
  client = await createAuth0Client({
    domain: authConfig().domain,
    clientId: authConfig().clientId,
    cacheLocation: "localstorage",
    useRefreshTokens: true,
    useRefreshTokensFallback: true,
    authorizationParams: {
      audience: authConfig().audience,
      redirect_uri: window.location.origin,
    },
  });
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    await client.handleRedirectCallback();
    const clean = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", clean);
    onLogin();
  }
  if (!(await client.isAuthenticated())) return signedOut();
  const user = await client.getUser();
  return user?.sub ? accountFromUser(user) : signedOut();
}

export async function login(signup: boolean): Promise<void> {
  if (!client) return;
  await client.loginWithRedirect({
    authorizationParams: {
      audience: authConfig().audience,
      redirect_uri: window.location.origin,
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

export async function idToken(): Promise<string | null> {
  if (!client) return null;
  const claims = await client.getIdTokenClaims();
  return claims?.__raw ?? null;
}
