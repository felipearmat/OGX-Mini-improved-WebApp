// Static server for the web app (the page has no build step), for the end-to-end tests.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 8123);
const TYPES = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".uf2": "application/octet-stream",
};

createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
    const file = join(ROOT, path.endsWith("/") ? `${path}index.html` : path);
    if (!file.startsWith(ROOT)) {
        response.writeHead(403).end();
        return;
    }
    try {
        const body = await readFile(file);
        response.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
        response.end(body);
    } catch {
        response.writeHead(404).end();
    }
}).listen(PORT, "127.0.0.1", () => console.log(`web app on http://127.0.0.1:${PORT}`));
