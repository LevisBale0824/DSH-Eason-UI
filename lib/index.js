import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
//#region lib/types/index.js
/**
* Aqua theme + pet plugin, node half.
*
* The browser half (exports["./client"]) owns the glassmorphism skin and the
* desktop pet widget. This node half does what the browser cannot: it serves
* the pet animation assets over HTTP and stores/serves the user's wallpaper
* file losslessly (localStorage would force a recompress to ~JPEG 0.82).
*
* Pet routes (prefix `/aqua-pet`):
*   GET /aqua-pet/manifest.json            → list of every installed pet pack
*   GET /aqua-pet/<petId>/thumb/<file>     → 360×360 playback variant (cached in memory)
*   GET /aqua-pet/<petId>/full/<file>      → original 1200×1200 master (no cache)
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
*
* Pet packs are directory-driven — adding a pet is dropping a folder, never a
* code change (see assets/pets/pet.schema.md). Roots are scanned in priority
* order and a later root overrides an earlier one on id clash:
*   1. <package>/assets/pets   (shipped packs, thumb cache warmed at startup)
*   2. config.extraPetRoots[]  (absolute paths from the patch layer)
*   3. $DSH_HOME/aqua-pets     (user drop zone; masters belong in full/)
*/
/** Plugin row id (matches cordis.patch.yml). */
const name = "ui-aqua";
/** Required services: the web server route registry. */
const inject = ["webServer"];
/** This package's root (works from src/ and from lib/ after install). */
const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** Route prefix: /aqua-pet/manifest.json, /aqua-pet/<petId>/{thumb|full}/<file>. */
const ROUTE_PREFIX = "/aqua-pet";
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
const MIME = {
	".webm": "video/webm",
	".mp4": "video/mp4",
	".png": "image/png",
	".json": "application/json; charset=utf-8"
};
/** Pet ids we accept in URLs (also blocks `..` style traversal via petId). */
const PET_ID_RE = /^[A-Za-z0-9_-]+$/;
/** Thumb cache: `${petId}/${fileName}` → Buffer. Warmed at startup for shipped packs. */
const thumbCache = /* @__PURE__ */ new Map();
/** Pet roots in priority order — a later root overrides an earlier one on id clash. */
function petRoots(config) {
	const roots = [join(PACKAGE_ROOT, "assets", "pets")];
	for (const extra of config.extraPetRoots ?? []) roots.push(resolve(extra));
	roots.push(config.homeRoot ? resolve(config.homeRoot) : join(resolveDshHome(), "aqua-pets"));
	return roots;
}
/** Minimal shape check for a parsed pet.json; returns the descriptor or undefined. */
function checkDescriptor(desc, dirName) {
	if (typeof desc !== "object" || desc === null) return void 0;
	const d = desc;
	const c = d.catalog;
	if (d.id !== dirName || typeof d.label !== "string") return void 0;
	if (typeof c?.idle !== "string" || typeof c?.drag !== "string") return void 0;
	if (typeof c?.walkLeft !== "string" || typeof c?.walkRight !== "string") return void 0;
	if (!Array.isArray(c?.turns) || !Array.isArray(c?.acts) || !Array.isArray(c?.clicks)) return void 0;
	const canvas = d.canvas;
	if (typeof canvas?.w !== "number" || typeof canvas?.h !== "number") return void 0;
	if (typeof d.feetY !== "number") return void 0;
	return desc;
}
/** Scan one root for pet packs; invalid packs warn and are skipped. */
function scanRoot(root) {
	let entries;
	try {
		entries = readdirSync(root, { withFileTypes: true });
	} catch {
		return [];
	}
	const found = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const descPath = join(root, entry.name, "pet.json");
		if (!existsSync(descPath)) continue;
		let desc;
		try {
			desc = checkDescriptor(JSON.parse(readFileSync(descPath, "utf8")), entry.name);
		} catch (err) {
			desc = void 0;
		}
		if (desc === void 0) {
			console.warn(`[ui-aqua] skipped invalid pet pack: ${descPath}`);
			continue;
		}
		found.push(desc);
	}
	return found;
}
/** Resolve a petId to its owning root, later roots winning (mirrors manifest order). */
function petDirFor(roots, petId) {
	for (let i = roots.length - 1; i >= 0; i -= 1) {
		const candidate = join(roots[i], petId);
		if (existsSync(candidate)) return candidate;
	}
}
/** Build the manifest: descriptors from every root, later roots overriding, sorted. */
function buildManifest(roots) {
	const byId = /* @__PURE__ */ new Map();
	for (const root of roots) for (const desc of scanRoot(root)) byId.set(desc.id, desc);
	return [...byId.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label));
}
/** Warm the thumb cache for the shipped packs (bounded, ~17MB per pack). */
function warmUpThumbCache() {
	const root = join(PACKAGE_ROOT, "assets", "pets");
	for (const desc of scanRoot(root)) {
		const thumbRoot = join(root, desc.id, "thumb");
		let names;
		try {
			names = readdirSync(thumbRoot);
		} catch (err) {
			console.warn(`[ui-aqua] warm-up skipped: cannot read ${thumbRoot}`);
			continue;
		}
		for (const fileName of names) {
			if (MIME[fileName.slice(fileName.lastIndexOf(".")).toLowerCase()] === void 0) continue;
			readFile(join(thumbRoot, fileName)).then((bytes) => thumbCache.set(`${desc.id}/${fileName}`, bytes), () => {});
		}
	}
}
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
/**
* Normalize and validate a requested path fragment so it stays inside the
* assets root (anti path-traversal; blocks `/aqua-pet/x/thumb/../../lib/...`).
*/
function resolveAsset(root, rel) {
	if (rel.length === 0) return void 0;
	const candidate = normalize(join(root, rel));
	const rootWithSep = root.endsWith(sep) ? root : root + sep;
	if (candidate !== root && !candidate.startsWith(rootWithSep)) return void 0;
	return candidate;
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
* Host plugin body: register the `/aqua-pet` prefix route + warm the cache.
* @param ctx - plugin context; ctx.webServer is the web server service.
* @param config - this row's config (from the patch tree).
*/
function apply(ctx, config = {}) {
	const roots = petRoots(config);
	warmUpThumbCache();
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
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: ROUTE_PREFIX,
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://localhost");
			const rest = decodeURIComponent(url.pathname.slice(10));
			if (rest === "manifest.json" || rest === "manifest") {
				sendBytes(res, 200, JSON.stringify({ pets: buildManifest(roots) }), MIME[".json"]);
				return;
			}
			const [petId, scope, ...nameParts] = rest.split("/");
			if (petId === void 0 || !PET_ID_RE.test(petId) || scope !== "thumb" && scope !== "full") {
				sendText(res, 400, "ui-aqua: expected /aqua-pet/manifest.json or /aqua-pet/<petId>/{thumb|full}/<file>");
				return;
			}
			const fileName = nameParts.join("/");
			const petDir = petDirFor(roots, petId);
			if (petDir === void 0) {
				sendText(res, 404, `ui-aqua: unknown pet pack '${petId}'`);
				return;
			}
			const file = resolveAsset(join(petDir, scope), fileName);
			if (file === void 0) {
				sendText(res, 400, "ui-aqua: invalid path");
				return;
			}
			const contentType = MIME[file.slice(file.lastIndexOf(".")).toLowerCase()] ?? "application/octet-stream";
			if (scope === "thumb") {
				let bytes = thumbCache.get(`${petId}/${fileName}`);
				if (bytes === void 0) {
					if (!existsSync(file)) {
						sendText(res, 404, "ui-aqua: asset not found");
						return;
					}
					bytes = await readFile(file);
					thumbCache.set(`${petId}/${fileName}`, bytes);
				}
				sendBytes(res, 200, bytes, contentType);
				return;
			}
			if (!existsSync(file)) {
				sendText(res, 404, `ui-aqua: original asset not found — populate ${join(petDir, "full")} first`);
				return;
			}
			sendBytes(res, 200, await readFile(file), contentType);
		}
	}), "ui-aqua: /aqua-pet asset route");
}
//#endregion
export { apply, inject, name };
