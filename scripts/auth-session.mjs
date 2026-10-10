import { loadEnv } from "./load-env.mjs";

loadEnv();

const username = process.env.TEST_USERNAME ?? "";
const password = process.env.TEST_PASSWORD ?? "";
const domain = (process.env.AUTH0_DOMAIN ?? "")
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");
const clientId = process.env.AUTH0_CLIENT_ID ?? "";
const audience = process.env.AUTH0_AUDIENCE || "https://identity.megazear7.com";
const realm = process.env.AUTH0_REALM || "Username-Password-Authentication";
const base = (process.env.NOURISH_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

if (!username || !password || !domain || !clientId) {
  console.error(
    "Set TEST_USERNAME, TEST_PASSWORD, AUTH0_DOMAIN, and AUTH0_CLIENT_ID.",
  );
  process.exit(1);
}

const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    grant_type: "http://auth0.com/oauth/grant-type/password-realm",
    realm,
    username,
    password,
    audience,
    scope: "openid profile email",
    client_id: clientId,
  }),
});
const tokenBody = await tokenResponse.json();
if (!tokenResponse.ok || !tokenBody.access_token) {
  const error = tokenBody.error ?? tokenResponse.status;
  const description = tokenBody.error_description ?? "token request failed";
  console.error(`Auth0 rejected the test account (${error}): ${description}`);
  if (error === "unauthorized_client" || error === "access_denied") {
    console.error(
      "Enable the Password grant on the Nourish Auth0 application, and allow the Username-Password-Authentication connection.",
    );
  }
  process.exit(1);
}

const state = await fetch(`${base}/api/state`, {
  headers: { authorization: `Bearer ${tokenBody.access_token}` },
});
const payload = await state.text();
console.log(`GET ${base}/api/state -> ${state.status}`);
if (!state.ok) {
  console.error(payload.slice(0, 400));
  process.exit(1);
}
const parsed = JSON.parse(payload);
console.log(
  `signed in as the test account; entries ${parsed.entries?.length ?? 0}, meals ${parsed.meals?.length ?? 0}, goals ${parsed.goals?.length ?? 0}`,
);
