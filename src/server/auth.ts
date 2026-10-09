import { createRemoteJWKSet, jwtVerify } from "jose";

export type Viewer = { userId: string; email: string | null };

export type Authenticator = (req: Request) => Promise<Viewer | null>;

const DEV_TOKEN = "dev";
const DEV_USER = "dev|local";

function domainHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export function liveAuth(): Authenticator {
  let jwksHost = "";
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  return async (req) => {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return null;
    if (process.env.NOURISH_ALLOW_DEV_USER === "1" && token === DEV_TOKEN) {
      return { userId: DEV_USER, email: "dev@localhost" };
    }
    const hosts = [
      ...hostsFrom(process.env.AUTH0_DOMAIN),
      ...hostsFrom(process.env.AUTH0_ISSUER_DOMAINS),
    ];
    const issuers = [...new Set(hosts.map((host) => `https://${host}/`))];
    if (!issuers.length) return null;
    if (!jwks || jwksHost !== hosts[0]) {
      jwksHost = hosts[0] ?? "";
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
      const email = typeof payload.email === "string" ? payload.email : null;
      return { userId: payload.sub, email };
    } catch {
      return null;
    }
  };
}

function hostsFrom(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map(domainHost).filter(Boolean);
}
