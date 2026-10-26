import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type Viewer = { userId: string; email: string | null };

export type Authenticator = (req: Request) => Promise<Viewer | null>;

function domainHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export function emailFromClaims(
  access: JWTPayload,
  idToken: JWTPayload | null,
): string | null {
  if (typeof access.email === "string" && access.email.trim()) {
    return access.email;
  }
  if (!idToken || idToken.sub !== access.sub) return null;
  if (typeof idToken.email !== "string" || !idToken.email.trim()) return null;
  return idToken.email;
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
      return { userId: payload.sub, email: emailFromClaims(payload, idToken) };
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

function hostsFrom(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map(domainHost).filter(Boolean);
}
