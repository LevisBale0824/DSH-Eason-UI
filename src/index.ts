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
import { mkdirSync, readdirSync } from 'node:fs'
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { join, resolve } from 'node:path'
// Official API: resolve $DSH_HOME (default ~/.dsh) — wallpaper store root.
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

/** Plugin row id (matches cordis.patch.yml). */
export const name = 'ui-aqua'
/** Required services: the web server route registry. */
export const inject = ['webServer']

/** Host plugin config (from the patch tree). */
export interface Config {
	/** Overrides the wallpaper store (default `$DSH_HOME/aqua-wallpaper`). */
	wallpaperRoot?: string
}

/** Route prefix for the wallpaper store: /aqua-wallpaper/{current,img}. */
const WALLPAPER_PREFIX = '/aqua-wallpaper'

/** Upload cap: 40MB of raw image is far beyond any sane wallpaper. */
const WALLPAPER_MAX_BYTES = 40 * 1024 * 1024

/** Accepted wallpaper formats: Content-Type → stored file extension. */
const WALLPAPER_TYPES: Record<string, string> = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/webp': '.webp',
	'image/gif': '.gif',
	'image/avif': '.avif',
	'image/bmp': '.bmp',
}

/** Content-Type per extension. */
const MIME: Record<string, string> = {
	'.json': 'application/json; charset=utf-8',
}

/** The wallpaper store directory (default `$DSH_HOME/aqua-wallpaper`). */
function wallpaperDir(config: Config): string {
	return config.wallpaperRoot ? resolve(config.wallpaperRoot) : join(resolveDshHome(), 'aqua-wallpaper')
}

/** The stored wallpaper pair: `original.<ext>` is the untouched upload (the
 *  crop editor's source, never modified in place); `wallpaper.<ext>` is what
 *  displays — the same bytes, or a crop of the original. */
interface WallpaperFiles {
	original: { path: string, ext: string }
	display: { path: string, ext: string }
}

/** The stored wallpaper pair, if any (original is the source of truth). */
function currentWallpaper(dir: string): WallpaperFiles | undefined {
	let names: string[]
	try {
		names = readdirSync(dir)
	} catch {
		return undefined // missing store is normal (nothing picked yet)
	}
	const extensions = Object.values(WALLPAPER_TYPES)
	let original: { path: string, ext: string } | undefined
	let display: { path: string, ext: string } | undefined
	for (const name of names) {
		const ext = name.slice(name.lastIndexOf('.'))
		if (!extensions.includes(ext)) continue
		if (name.startsWith('original.') && original === undefined) original = { path: join(dir, name), ext }
		else if (name.startsWith('wallpaper.') && display === undefined) display = { path: join(dir, name), ext }
	}
	if (original === undefined) return undefined
	return { original, display: display ?? original }
}

/** Drop `original.<other-ext>` / `wallpaper.<other-ext>` leftovers. */
async function cleanWallpaperVariants(dir: string, keepExt: string, prefixes: readonly string[]): Promise<void> {
	for (const other of Object.values(WALLPAPER_TYPES)) {
		if (other === keepExt) continue
		for (const prefix of prefixes) await unlink(join(dir, `${prefix}${other}`)).catch(() => {})
	}
}

/** The wallpaper URL pinned to the file's version (mtime busts caches). */
async function wallpaperUrl(file: string, kind: 'img' | 'original' = 'img'): Promise<string> {
	return `${WALLPAPER_PREFIX}/${kind}?v=${Math.round((await stat(file)).mtimeMs)}`
}

/** Invert WALLPAPER_TYPES: stored extension → Content-Type. */
function wallpaperMime(ext: string): string {
	for (const [mime, candidate] of Object.entries(WALLPAPER_TYPES)) {
		if (candidate === ext) return mime
	}
	return 'application/octet-stream'
}

/** Serve bytes with common headers. */
function sendBytes(res: unknown, status: number, bytes: Buffer | string, contentType: string): void {
	const r = res as { writeHead(code: number, headers: Record<string, string | number>): void, end(body: Buffer | string): void }
	r.writeHead(status, {
		'content-type': contentType,
		'content-length': Buffer.byteLength(bytes),
		'cache-control': 'public, max-age=3600',
	})
	r.end(bytes)
}

/** Plain-text error helper. */
function sendText(res: unknown, status: number, text: string): void {
	sendBytes(res, status, text, 'text/plain; charset=utf-8')
}

/**
 * Host plugin body: register the `/aqua-wallpaper` store route.
 * @param ctx - plugin context; ctx.webServer is the web server service.
 * @param config - this row's config (from the patch tree).
 */
export function apply(ctx: Context, config: Config = {}): void {
	ctx.effect(() => ctx.webServer.register({
		kind: 'prefix',
		path: WALLPAPER_PREFIX,
		handler: async (req: IncomingMessage, res: unknown) => {
			const url = new URL(req.url ?? '/', 'http://localhost')
			const rest = decodeURIComponent(url.pathname.slice(WALLPAPER_PREFIX.length + 1))
			if (rest !== 'img' && rest !== 'current' && rest !== 'original' && rest !== 'cropped') {
				sendText(res, 404, 'ui-aqua: expected /aqua-wallpaper/{current,img,original,cropped}')
				return
			}
			const dir = wallpaperDir(config)
			const method = (req.method ?? 'GET').toUpperCase()

			// Probe: lets a fresh browser adopt a wallpaper picked elsewhere,
			// and hands the crop editor the untouched original's URL.
			if (rest === 'current') {
				const found = currentWallpaper(dir)
				const payload = found === undefined
					? { exists: false }
					: {
							exists: true,
							url: await wallpaperUrl(found.display.path),
							originalUrl: await wallpaperUrl(found.original.path, 'original'),
							mime: wallpaperMime(found.display.ext),
						}
				sendBytes(res, 200, JSON.stringify(payload), MIME['.json']!)
				return
			}

			if (method === 'DELETE') {
				// Remove the whole pair (original + display, every format).
				mkdirSync(dir, { recursive: true })
				for (const other of Object.values(WALLPAPER_TYPES)) {
					await unlink(join(dir, `original${other}`)).catch(() => {})
					await unlink(join(dir, `wallpaper${other}`)).catch(() => {})
				}
				sendBytes(res, 200, JSON.stringify({ ok: true }), MIME['.json']!)
				return
			}

			if (method === 'PUT') {
				const mime = String(req.headers?.['content-type'] ?? '').split(';')[0]!.trim().toLowerCase()
				const ext = WALLPAPER_TYPES[mime]
				if (ext === undefined) {
					sendText(res, 415, `ui-aqua: unsupported wallpaper type '${mime}'`)
					return
				}
				const chunks: Buffer[] = []
				let total = 0
				const iterable = req[Symbol.asyncIterator] === undefined ? undefined : req as AsyncIterable<Buffer>
				if (iterable !== undefined) {
					for await (const chunk of iterable) {
						total += chunk.length
						if (total > WALLPAPER_MAX_BYTES) {
							sendText(res, 413, 'ui-aqua: wallpaper larger than 40MB')
							req.destroy?.()
							return
						}
						chunks.push(chunk)
					}
				}
				if (total === 0) {
					sendText(res, 400, 'ui-aqua: empty wallpaper body')
					return
				}
				const bytes = Buffer.concat(chunks)
				mkdirSync(dir, { recursive: true })
				// `img` = a freshly chosen image: original AND display become
				// these bytes; `cropped` = the crop editor's output: only the
				// display file moves, the untouched original survives so the
				// user can re-crop without generation loss.
				const staging = join(dir, '.wallpaper.staging')
				await writeFile(staging, bytes)
				await rename(staging, join(dir, `wallpaper${ext}`))
				if (rest === 'img') await writeFile(join(dir, `original${ext}`), bytes)
				await cleanWallpaperVariants(dir, ext, rest === 'img' ? ['original', 'wallpaper'] : ['wallpaper'])
				sendBytes(res, 200, JSON.stringify({ url: await wallpaperUrl(join(dir, `wallpaper${ext}`)) }), MIME['.json']!)
				return
			}

			// GET img/original: serve the stored bytes, never re-encoded.
			const found = currentWallpaper(dir)
			if (found === undefined) {
				sendText(res, 404, 'ui-aqua: no wallpaper stored')
				return
			}
			const file = rest === 'original' ? found.original : found.display
			sendBytes(res, 200, await readFile(file.path), wallpaperMime(file.ext))
		},
	} satisfies WebRoute), 'ui-aqua: /aqua-wallpaper store route')
}
