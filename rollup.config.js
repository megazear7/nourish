import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { loadEnv } from "./scripts/load-env.mjs";

loadEnv();

const domain = process.env.AUTH0_DOMAIN ?? "";
const clientId = process.env.AUTH0_CLIENT_ID ?? "";
if (!domain || !clientId) {
  console.error(
    "AUTH0_DOMAIN or AUTH0_CLIENT_ID is missing. This build cannot sign in.",
  );
}

const quoted = (name, fallback = "") =>
  JSON.stringify(process.env[name] ?? fallback);

export default {
  input: "src/client/app.ts",
  output: {
    file: "dist/client/bundle.js",
    format: "esm",
  },
  onwarn(warning) {
    if (
      warning.code !== "THIS_IS_UNSUPPORTED_FEATURE" &&
      warning.code !== "THIS_IS_PURE"
    ) {
      console.error(`(!) ${warning.message}`);
    }
  },
  plugins: [
    replace({
      preventAssignment: true,
      __NOURISH_AUTH0_DOMAIN__: quoted("AUTH0_DOMAIN"),
      __NOURISH_AUTH0_CLIENT_ID__: quoted("AUTH0_CLIENT_ID"),
      __NOURISH_AUTH0_AUDIENCE__: quoted(
        "AUTH0_AUDIENCE",
        "https://identity.megazear7.com",
      ),
      __NOURISH_IDENTITY_URL__: quoted(
        "NOURISH_IDENTITY_URL",
        "https://identity.megazear7.com/data",
      ),
      "Reflect.decorate": "undefined",
    }),
    typescript({
      declaration: false,
      declarationMap: false,
      outDir: "dist/client",
    }),
    resolve(),
  ],
};
