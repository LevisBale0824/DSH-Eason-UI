import { mkdirSync, readdirSync } from "node:fs";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
//#region lib/types/index.js
/**
* Aqua theme plugin, node half.
*
* The browser half (exports["./client"]) owns the glassmorphism skin. This
* node half does what the browser cannot: it stores/serves the user's
* wallpaper file losslessly (localStorage would force a recompress to
* ~JPEG 0.82).
*
* Wallpaper routes (prefix `/aqua-wallpaper`, files kept under
* `$DSH_HOME/aqua-wallpaper/` — original bytes, never re-encoded):
*   GET    /aqua-wallpaper/current  → { exists, url?, originalUrl?, mime? }
*   GET    /aqua-wallpaper/img      → the displayed image (add ?v=<mtime> to pin)
*   GET    /aqua-wallpaper/original → the untouched upload (crop editor source)
*   PUT    /aqua-wallpaper/img      → choose a new image: body = raw bytes (≤40MB),
*                                     writes original.<ext> + wallpaper.<ext>
*   PUT    /aqua-wallpaper/cropped  → crop-editor output: writes wallpaper.<ext>
*                                     only, the original survives (re-crop lossless)
*   DELETE /aqua-wallpaper/img      → remove the stored pair
*/
/** Plugin row id (matches cordis.patch.yml). */
const name = "ui-aqua";
/** Required services: the web server route registry. */
const inject = ["webServer"];
/** Route prefix for the wallpaper store: /aqua-wallpaper/{current,img}. */
const WALLPAPER_PREFIX = "/aqua-wallpaper";
/** Upload cap: 40MB of raw image is far beyond any sane wallpaper. */
const WALLPAPER_MAX_BYTES = 40 * 1024 * 1024;
/** Accepted wallpaper formats: Content-Type → stored file extension. */
const WALLPAPER_TYPES = {
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/webp": ".webp",
	"image/gif": ".gif",
	"image/avif": ".avif",
	"image/bmp": ".bmp"
};
/** Content-Type per extension. */
const MIME = { ".json": "application/json; charset=utf-8" };
/** The wallpaper store directory (default `$DSH_HOME/aqua-wallpaper`). */
function wallpaperDir(config) {
	return config.wallpaperRoot ? resolve(config.wallpaperRoot) : join(resolveDshHome(), "aqua-wallpaper");
}
/** The stored wallpaper pair, if any (original is the source of truth). */
function currentWallpaper(dir) {
	let names;
	try {
		names = readdirSync(dir);
	} catch {
		return;
	}
	const extensions = Object.values(WALLPAPER_TYPES);
	let original;
	let display;
	for (const name of names) {
		const ext = name.slice(name.lastIndexOf("."));
		if (!extensions.includes(ext)) continue;
		if (name.startsWith("original.") && original === void 0) original = {
			path: join(dir, name),
			ext
		};
		else if (name.startsWith("wallpaper.") && display === void 0) display = {
			path: join(dir, name),
			ext
		};
	}
	if (original === void 0) return void 0;
	return {
		original,
		display: display ?? original
	};
}
/** Drop `original.<other-ext>` / `wallpaper.<other-ext>` leftovers. */
async function cleanWallpaperVariants(dir, keepExt, prefixes) {
	for (const other of Object.values(WALLPAPER_TYPES)) {
		if (other === keepExt) continue;
		for (const prefix of prefixes) await unlink(join(dir, `${prefix}${other}`)).catch(() => {});
	}
}
/** The wallpaper URL pinned to the file's version (mtime busts caches). */
async function wallpaperUrl(file, kind = "img") {
	return `${WALLPAPER_PREFIX}/${kind}?v=${Math.round((await stat(file)).mtimeMs)}`;
}
/** Invert WALLPAPER_TYPES: stored extension → Content-Type. */
function wallpaperMime(ext) {
	for (const [mime, candidate] of Object.entries(WALLPAPER_TYPES)) if (candidate === ext) return mime;
	return "application/octet-stream";
}
/** Serve bytes with common headers. */
function sendBytes(res, status, bytes, contentType) {
	const r = res;
	r.writeHead(status, {
		"content-type": contentType,
		"content-length": Buffer.byteLength(bytes),
		"cache-control": "public, max-age=3600"
	});
	r.end(bytes);
}
/** Plain-text error helper. */
function sendText(res, status, text) {
	sendBytes(res, status, text, "text/plain; charset=utf-8");
}
/**
* Host plugin body: register the `/aqua-wallpaper` store route.
* @param ctx - plugin context; ctx.webServer is the web server service.
* @param config - this row's config (from the patch tree).
*/
function apply(ctx, config = {}) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: WALLPAPER_PREFIX,
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://localhost");
			const rest = decodeURIComponent(url.pathname.slice(16));
			if (rest !== "img" && rest !== "current" && rest !== "original" && rest !== "cropped") {
				sendText(res, 404, "ui-aqua: expected /aqua-wallpaper/{current,img,original,cropped}");
				return;
			}
			const dir = wallpaperDir(config);
			const method = (req.method ?? "GET").toUpperCase();
			if (rest === "current") {
				const found = currentWallpaper(dir);
				const payload = found === void 0 ? { exists: false } : {
					exists: true,
					url: await wallpaperUrl(found.display.path),
					originalUrl: await wallpaperUrl(found.original.path, "original"),
					mime: wallpaperMime(found.display.ext)
				};
				sendBytes(res, 200, JSON.stringify(payload), MIME[".json"]);
				return;
			}
			if (method === "DELETE") {
				mkdirSync(dir, { recursive: true });
				for (const other of Object.values(WALLPAPER_TYPES)) {
					await unlink(join(dir, `original${other}`)).catch(() => {});
					await unlink(join(dir, `wallpaper${other}`)).catch(() => {});
				}
				sendBytes(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
				return;
			}
			if (method === "PUT") {
				const mime = String(req.headers?.["content-type"] ?? "").split(";")[0].trim().toLowerCase();
				const ext = WALLPAPER_TYPES[mime];
				if (ext === void 0) {
					sendText(res, 415, `ui-aqua: unsupported wallpaper type '${mime}'`);
					return;
				}
				const chunks = [];
				let total = 0;
				const iterable = req[Symbol.asyncIterator] === void 0 ? void 0 : req;
				if (iterable !== void 0) for await (const chunk of iterable) {
					total += chunk.length;
					if (total > WALLPAPER_MAX_BYTES) {
						sendText(res, 413, "ui-aqua: wallpaper larger than 40MB");
						req.destroy?.();
						return;
					}
					chunks.push(chunk);
				}
				if (total === 0) {
					sendText(res, 400, "ui-aqua: empty wallpaper body");
					return;
				}
				const bytes = Buffer.concat(chunks);
				mkdirSync(dir, { recursive: true });
				const staging = join(dir, ".wallpaper.staging");
				await writeFile(staging, bytes);
				await rename(staging, join(dir, `wallpaper${ext}`));
				if (rest === "img") await writeFile(join(dir, `original${ext}`), bytes);
				await cleanWallpaperVariants(dir, ext, rest === "img" ? ["original", "wallpaper"] : ["wallpaper"]);
				sendBytes(res, 200, JSON.stringify({ url: await wallpaperUrl(join(dir, `wallpaper${ext}`)) }), MIME[".json"]);
				return;
			}
			const found = currentWallpaper(dir);
			if (found === void 0) {
				sendText(res, 404, "ui-aqua: no wallpaper stored");
				return;
			}
			const file = rest === "original" ? found.original : found.display;
			sendBytes(res, 200, await readFile(file.path), wallpaperMime(file.ext));
		}
	}), "ui-aqua: /aqua-wallpaper store route");
}
//#endregion
export { apply, inject, name };
