import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist/client");

await mkdir(dist, { recursive: true });
await cp(path.join(root, "index.html"), path.join(dist, "index.html"));
await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
await cp(path.join(root, "favicon.svg"), path.join(dist, "favicon.svg"));
await cp(path.join(root, "public/apple-touch-icon.png"), path.join(dist, "apple-touch-icon.png"));
await cp(path.join(root, "public/icons"), path.join(dist, "icons"), { recursive: true });
await cp(path.join(root, "public/fonts"), path.join(dist, "fonts"), { recursive: true });

const bundlePath = path.join(dist, "bundle.js");
const bundle = await readFile(bundlePath);
const buildId = createHash("sha256").update(bundle).digest("hex").slice(0, 12);
const template = await readFile(path.join(root, "public/sw.js"), "utf8");
if (!template.includes("__NOURISH_BUILD__")) {
  throw new Error("public/sw.js is missing __NOURISH_BUILD__");
}
await writeFile(path.join(dist, "sw.js"), template.replaceAll("__NOURISH_BUILD__", buildId));
