import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(root, "dist/client");
const { FileStore } = await import("../dist/tsc/server/file-store.js");
const { handleApi } = await import("../dist/tsc/server/handle.js");
const { liveAuth } = await import("../dist/tsc/server/auth.js");

const store = new FileStore(path.join(root, "data/nourish.json"));
const authenticate = liveAuth();
const port = Number(process.env.PORT || 3000);

const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".svg", "image/svg+xml"],
]);

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const file = path.resolve(clientRoot, relative);
  if (!file.startsWith(clientRoot)) return null;
  return file;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const headers = new Headers();
      const authHeader = req.headers.authorization;
      const type = req.headers["content-type"];
      if (typeof authHeader === "string") headers.set("authorization", authHeader);
      if (typeof type === "string") headers.set("content-type", type);
      const request = new Request(url, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      const response = await handleApi(request, store, authenticate);
      const payload = Buffer.from(await response.arrayBuffer());
      const out = {};
      response.headers.forEach((value, key) => {
        out[key] = value;
      });
      res.writeHead(response.status, out);
      res.end(payload);
      return;
    }

    const file = safeFile(url.pathname);
    if (!file) {
      res.writeHead(400);
      res.end("Bad path");
      return;
    }
    try {
      const info = await stat(file);
      if (info.isFile()) {
        const ext = path.extname(file);
        res.writeHead(200, { "content-type": TYPES.get(ext) ?? "application/octet-stream" });
        res.end(await readFile(file));
        return;
      }
    } catch {
      /* Fall through to the app shell. */
    }
    if (path.extname(url.pathname)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(await readFile(path.join(clientRoot, "index.html")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "server error";
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(message);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Nourish http://127.0.0.1:${port}`);
});
