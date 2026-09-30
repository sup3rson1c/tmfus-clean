/* Static server for the VANTA site. Usage: node serve.mjs [port] */
import { createServer } from "node:http";
import { handleApi, MOCK_ROUTES } from "./tools/api-mock.mjs";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Serve the directory this script lives in, not the caller's cwd, so the
// launch config can start it from the workspace root.
const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);

    // The PHP backend cannot run here, so the dev server answers the same
    // URLs with mock responses. Production serves the real api/*.php.
    if (path.startsWith("/api/") && (await handleApi(req, res, path))) return;
    if (path.endsWith("/")) path += "index.html";
    // Clean URLs, as the live .htaccess serves them: /apply -> apply.html
    else if (!extname(path)) path += ".html";
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    const info = await stat(file);
    const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";

    // Range support so <video> can seek instead of refetching whole files.
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [s, e] = range.replace("bytes=", "").split("-");
      const start = Number(s);
      const end = e ? Number(e) : info.size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${info.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": info.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    if (info.size > 1_000_000) createReadStream(file).pipe(res);
    else res.end(await readFile(file));
  } catch {
    // As the live .htaccess does: ErrorDocument 404 /404.html
    try {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end(await readFile(join(ROOT, "404.html")));
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
    }
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
