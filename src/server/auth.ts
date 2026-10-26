import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type Viewer = { userId: string; email: string | null };

export type Authenticator = (req: Request) => Promise<Viewer | null>;

function domainHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function claimEmail(payload: JWTPayload): string | null {
  if (typeof payload.email === "string" && payload.email.trim()) {
    return payload.email.trim();
  }
  for (const [key, value] of Object.entries(payload)) {
    if (!key.endsWith("/email")) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function emailFromClaims(
  access: JWTPayload,
  idToken: JWTPayload | null,
): string | null {
  const accessEmail = claimEmail(access);
  if (accessEmail) return accessEmail;
  if (!idToken || idToken.sub !== access.sub) return null;
  return claimEmail(idToken);
}

export function liveAuth(): Authenticator {
  let jwksHost = "";
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  return async (req) => {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return null;
    const hosts = [
      ...hostsFrom(process.env.AUTH0_DOMAIN),
      ...hostsFrom(process.env.AUTH0_ISSUER_DOMAINS),
    ];
    const issuers = [...new Set(hosts.map((host) => `https://${host}/`))];
    if (!issuers.length || !hosts[0]) return null;
    if (!jwks || jwksHost !== hosts[0]) {
      jwksHost = hosts[0];
      jwks = createRemoteJWKSet(
        new URL(`https://${jwksHost}/.well-known/jwks.json`),
      );
    }
    const audience = (
      process.env.AUTH0_AUDIENCE ?? "https://identity.megazear7.com"
    ).trim();
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: issuers,
        audience,
      });
      if (!payload.sub || payload.sub.length > 128) return null;
      const idToken = await verifiedIdToken(req, jwks, issuers);
      let email = emailFromClaims(payload, idToken);
      if (!email) {
        const host = issuerHost(payload) ?? hosts[0];
        email = await emailFromUserInfo(token, host);
      }
      return { userId: payload.sub, email };
    } catch {
      return null;
    }
  };
}

async function verifiedIdToken(
  req: Request,
  jwks: ReturnType<typeof createRemoteJWKSet>,
  issuers: string[],
): Promise<JWTPayload | null> {
  const raw = (req.headers.get("x-id-token") ?? "").trim();
  if (!raw) return null;
  const clientId = (process.env.AUTH0_CLIENT_ID ?? "").trim();
  try {
    const { payload } = await jwtVerify(raw, jwks, {
      issuer: issuers,
      ...(clientId ? { audience: clientId } : {}),
    });
    return payload;
  } catch {
    return null;
  }
}

function issuerHost(payload: JWTPayload): string | null {
  if (typeof payload.iss !== "string") return null;
  try {
    return new URL(payload.iss).host;
  } catch {
    return null;
  }
}

async function emailFromUserInfo(
  token: string,
  host: string,
): Promise<string | null> {
  try {
    const response = await fetch(`https://${host}/userinfo`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { email?: unknown };
    return typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;
  } catch {
    return null;
  }
}

function hostsFrom(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map(domainHost).filter(Boolean);
}
