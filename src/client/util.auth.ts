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

function accountFromUser(user: {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
}): Account {
  return {
    status: "signed-in",
    sub: user.sub ?? "",
    name: user.name ?? "",
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

export async function accessToken(): Promise<string | null> {
  if (!client) return null;
  try {
    return (await client.getTokenSilently()) ?? null;
  } catch {
    return null;
  }
}

export async function idToken(): Promise<string | null> {
  if (!client) return null;
  const claims = await client.getIdTokenClaims();
  return claims?.__raw ?? null;
}
