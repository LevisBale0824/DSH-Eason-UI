/**
 * Aqua pet engine, client side — a multi-pet desktop pet.
 *
 * Ported from the standalone eason-pet plugin and parameterized: everything
 * character-specific (animation catalog, canvas metrics, asset URL) comes from
 * a pet descriptor fetched from the host half's `/aqua-pet/manifest.json`.
 * The pet packs themselves are plain directories on the host (see
 * assets/pets/pet.schema.md) — adding or switching a pet never touches code.
 *
 * Rendering style note: this module is written with explicit `h()` calls
 * (react/jsx-runtime) instead of JSX syntax so it stays a 1:1 mirror of the
 * hand-maintained section appended to lib/client.js (this fork ships the
 * bundle as the live artifact; the monorepo build is optional).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as react from 'react'
import { jsx as h } from 'react/jsx-runtime'

/** A pet descriptor from /aqua-pet/manifest.json (contract: pet.schema.md). */
export interface PetDescriptor {
	id: string
	label: string
	description?: string
	order?: number
	canvas: { w: number, h: number }
	feetY: number
	catalog: {
		idle: string
		turns: string[]
		acts: string[]
		clicks: string[]
		drag: string
		walkLeft: string
		walkRight: string
	}
}

/** Client-side minimal shape check for manifest entries. */
function isValidPet(p: unknown): p is PetDescriptor {
	if (typeof p !== 'object' || p === null) return false
	const d = p as Record<string, unknown>
	const c = d.catalog as Record<string, unknown> | undefined
	return typeof d.id === 'string' && d.id.length > 0
		&& typeof d.label === 'string'
		&& typeof c?.idle === 'string' && typeof c?.drag === 'string'
		&& typeof c?.walkLeft === 'string' && typeof c?.walkRight === 'string'
		&& Array.isArray(c?.turns) && Array.isArray(c?.acts) && Array.isArray(c?.clicks)
}

// ============================================================================
// Inline CSS — injected once, official client-plugin style.
// ============================================================================
// Class prefix aqua-pet-*: independent of the (former) eason-pet plugin and
// of dsh-pet, so any of them can coexist during migration.
const css = [
	'.aqua-pet-root{position:fixed;z-index:40;pointer-events:none;user-select:none}',
	'.aqua-pet-root[data-corner="bottom-right"]{right:24px;bottom:0}',
	'.aqua-pet-root[data-corner="bottom-left"]{left:24px;bottom:0}',
	'.aqua-pet-stage{position:relative;width:var(--aqua-pet-size,260px);height:var(--aqua-pet-size,260px);pointer-events:none}',
	'.aqua-pet-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:auto;cursor:grab;opacity:0;transition:opacity .18s ease;transform-origin:center;will-change:opacity}',
	'.aqua-pet-video.is-front{opacity:1}',
	'.aqua-pet-video:active{cursor:grabbing}',
	'.aqua-pet-menu{position:fixed;z-index:60;pointer-events:auto;min-width:150px;padding:4px;border-radius:8px;background:rgba(28,28,32,.96);color:#eee;font-size:13px;line-height:1;box-shadow:0 6px 24px rgba(0,0,0,.35)}',
	'.aqua-pet-menu-item{display:block;width:100%;padding:8px 10px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:nowrap}',
	'.aqua-pet-menu-item:hover{background:rgba(255,255,255,.12)}',
	'.aqua-pet-menu-sep{height:1px;margin:4px 6px;background:rgba(255,255,255,.18)}',
	// ---- settings page (settings.section「桌宠」) ----
	'.aqua-pet-setting{display:flex;flex-direction:column;width:100%;font-size:13px;color:var(--dsw-alias-label-primary,#ddd)}',
	'.aqua-pet-setting-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 2px;border-bottom:1px solid rgba(128,128,128,.25)}',
	'.aqua-pet-setting-row:last-child{border-bottom:none}',
	'.aqua-pet-setting-label{display:flex;flex-direction:column;gap:4px;min-width:0}',
	'.aqua-pet-setting-title{font-weight:600}',
	'.aqua-pet-setting-desc{font-size:12px;opacity:.65;line-height:1.5}',
	'.aqua-pet-setting-check{width:16px;height:16px;cursor:pointer;accent-color:var(--dsw-alias-label-primary,#5b8cff)}',
	'.aqua-pet-setting-range{width:180px;cursor:pointer;accent-color:var(--dsw-alias-label-primary,#5b8cff)}',
	'.aqua-pet-setting-size-val{min-width:44px;text-align:right;font-variant-numeric:tabular-nums;opacity:.7}',
	'.aqua-pet-setting-select{padding:6px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;cursor:pointer;max-width:220px}',
	'.aqua-pet-setting-btn{padding:6px 14px;border-radius:6px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;cursor:pointer}',
	'.aqua-pet-setting-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15))}',
	'@media (prefers-reduced-motion: reduce){.aqua-pet-video{transition:none}}',
].join('\n')
const cssTag = 'aqua-pet/style.css'
if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${cssTag}"]`) === null) {
	const tag = document.createElement('style')
	tag.dataset.plugin = 'aqua-pet'
	tag.dataset.pluginCss = cssTag
	tag.textContent = css
	document.head.appendChild(tag)
}

// ---- settings persistence keys (localStorage; settings page & menu share) ----
const LS_KEY = {
	petId: 'aqua-pet.petId',
	roaming: 'aqua-pet.roaming',
	size: 'aqua-pet.size',
	corner: 'aqua-pet.corner',
	hidden: 'aqua-pet.hidden',
} as const
// localStorage 读写兜底：隐私模式等场景下静默降级（设置仅本次生效）
const lsGet = (key: string): string | null => { try { return window.localStorage.getItem(key) } catch { return null } }
const lsSet = (key: string, val: string): void => { try { window.localStorage.setItem(key, val) } catch { /* 同上忽略 */ } }

// One-time migration from the standalone eason-pet plugin's keys, so an
// existing install keeps its size / corner / roaming / hidden choices.
function migrateFromEasonPet(): void {
	const pairs: Array<[keyof typeof LS_KEY, string]> = [
		['size', 'eason-pet.size'],
		['corner', 'eason-pet.corner'],
		['roaming', 'eason-pet.roaming'],
		['hidden', 'eason-pet.hidden'],
	]
	for (const [newKey, oldKey] of pairs) {
		if (lsGet(LS_KEY[newKey]) !== null) continue
		const old = lsGet(oldKey)
		if (old !== null) lsSet(LS_KEY[newKey], old)
	}
}

// 移动参数（与 eason-pet 相同的经验值）
const MOVE_MIN_PX = 60
const MOVE_MAX_PX = 240
const MOVE_MARGIN = 20
const MOVE_LEAD_SEC = 2
const MOVE_TAIL_SEC = 2

const pick = (pool: string[], exclude?: string): string => {
	const entries = exclude !== undefined ? pool.filter((n) => n !== exclude) : pool
	return entries.length > 0 ? entries[Math.floor(Math.random() * entries.length)]! : ''
}
const randomBetween = (min: number, max: number): number => Math.floor(min + Math.random() * (max - min))

// ============================================================================
// Shared settings store — the single source of truth for the pet widget and
// the settings page. The DSH client config pipeline does not deliver patch
// config to the browser, so runtime settings live in localStorage (same
// approach as the standalone plugin).
// ============================================================================
const DEFAULT_SIZE = 260
const clampSize = (n: unknown): number => Math.min(420, Math.max(160, Math.round(Number(n) || DEFAULT_SIZE)))

migrateFromEasonPet()

interface PetState {
	/** Manifest entries; empty until the fetch lands. */
	pets: PetDescriptor[]
	/** Selected pet id; null until the manifest resolves a default. */
	petId: string | null
	size: number
	corner: 'bottom-right' | 'bottom-left'
	roaming: boolean
	hidden: boolean
	/** Reset-position token: bumped by the settings page, not persisted. */
	resetToken: number
}
let petState: PetState = {
	pets: [],
	petId: ((): string | null => { const v = lsGet(LS_KEY.petId); return v === null ? null : v })(),
	size: clampSize(lsGet(LS_KEY.size)),
	corner: lsGet(LS_KEY.corner) === 'bottom-left' ? 'bottom-left' : 'bottom-right',
	roaming: lsGet(LS_KEY.roaming) === '1',
	hidden: lsGet(LS_KEY.hidden) === '1',
	resetToken: 0,
}
const petListeners = new Set<() => void>()
const petStore = {
	get: (): PetState => petState,
	set(patch: Partial<PetState>): void {
		petState = { ...petState, ...patch }
		if (patch.petId !== undefined) lsSet(LS_KEY.petId, petState.petId ?? '')
		if (patch.size !== undefined) lsSet(LS_KEY.size, String(petState.size))
		if (patch.corner !== undefined) lsSet(LS_KEY.corner, petState.corner)
		if (patch.roaming !== undefined) lsSet(LS_KEY.roaming, petState.roaming ? '1' : '0')
		if (patch.hidden !== undefined) lsSet(LS_KEY.hidden, petState.hidden ? '1' : '0')
		for (const fn of petListeners) fn()
	},
}
const usePetState = (): PetState => useSyncExternalStore(
	(onStoreChange) => {
		petListeners.add(onStoreChange)
		return () => petListeners.delete(onStoreChange)
	},
	() => petState,
)

// ---- manifest: fetched once when the bundle loads ----
let manifestStarted = false
function loadManifest(): void {
	if (manifestStarted || typeof window === 'undefined') return
	manifestStarted = true
	fetch('/aqua-pet/manifest.json', { cache: 'no-store' })
		.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
		.then((data: { pets?: unknown[] }) => {
			const pets = Array.isArray(data?.pets) ? data!.pets!.filter(isValidPet) : []
			petStore.set({ pets })
			if (pets.length > 0 && !pets.some((p) => p.id === petState.petId)) {
				petStore.set({ petId: pets[0]!.id })
			}
		})
		.catch((err: Error) => { console.warn('[aqua-pet] manifest load failed:', err?.message ?? err) })
}
loadManifest()

/** Animation asset URL for a pet. */
const assetUrl = (petId: string, name: string): string => `/aqua-pet/${petId}/thumb/${encodeURIComponent(name)}.webm`

/**
 * The pet widget. Responsibilities (all inherited from eason-pet, now
 * descriptor-driven):
 * 1. double-buffered `<video>` pair with cross-fade — never a blank frame;
 * 2. chain state machine: idle → probability → turn/act (+ walk when roaming);
 * 3. click / drag / right-click menu (roaming toggle, reset, switch pet);
 * 4. facing via CSS mirror, except the direction-locked walk animations.
 */
function Pet(): ReturnType<typeof h> {
	const settings = usePetState()
	const size = settings.size
	const corner = settings.corner
	const roaming = settings.roaming
	const pets = settings.pets
	const pet = pets.find((p) => p.id === settings.petId) ?? null

	const [anim, setAnim] = useState('')        // 当前动画名（'' = 宠物未就绪）
	const [once, setOnce] = useState(true)      // 链式模型全部一次性播放
	const [facing, setFacing] = useState<'left' | 'right'>('left')
	const [dragging, setDragging] = useState(false)
	const [customPos, setCustomPos] = useState<{ rx: number, ry: number } | null>(null)
	const [menu, setMenu] = useState<{ x: number, y: number } | null>(null)
	const [seq, setSeq] = useState(0)           // 播放序号：连续选中同一动画也重播

	const rootRef = useRef<HTMLElement | null>(null)
	const stageRef = useRef<HTMLElement | null>(null)
	const videoARef = useRef<HTMLVideoElement | null>(null)
	const videoBRef = useRef<HTMLVideoElement | null>(null)

	const frontRef = useRef(0)
	const pendingRef = useRef<{ anim: string, once: boolean, gen: number } | null>(null)
	const genRef = useRef(0)
	const dragRef = useRef({ active: false, dragging: false, sx: 0, sy: 0 })
	const justDraggedRef = useRef(false)
	const animRef = useRef('')
	animRef.current = anim
	const facingRef = useRef(facing)
	facingRef.current = facing
	const roamingRef = useRef(roaming)
	roamingRef.current = roaming
	const petRef = useRef<PetDescriptor | null>(pet)
	petRef.current = pet
	const sizeRef = useRef(size)
	sizeRef.current = size

	const stopMove = (): void => {
		pendingMoveRef.current = null
		moveTokenRef.current += 1
		if (moveRef.current !== null) {
			cancelAnimationFrame(moveRef.current)
			moveRef.current = null
		}
	}

	// 宠物就绪 / 切换宠物：回该宠物的待机动画重新开局
	const readyPetIdRef = useRef<string | null>(null)
	useEffect(() => {
		if (pet === null) { readyPetIdRef.current = null; return }
		if (readyPetIdRef.current === pet.id) return
		readyPetIdRef.current = pet.id
		stopMove()
		setFacing('left')
		setAnim(pet.catalog.idle)
		setOnce(true)
		setSeq((s) => s + 1)
	}, [pet?.id])

	// 双缓冲切换：目标动画进"非显示"视频 → loadeddata → 交叉淡入，旧视频暂停
	const switchTo = (next: string, nextOnce: boolean): void => {
		if (next === '') return
		const cur = petRef.current
		if (cur === null) return
		const pending = pendingRef.current
		if (pending !== null && pending.anim === next && pending.once === nextOnce) return
		const gen = ++genRef.current
		pendingRef.current = { anim: next, once: nextOnce, gen }

		const target = frontRef.current === 0 ? videoBRef : videoARef
		const el = target.current
		if (el == null) return
		el.src = assetUrl(cur.id, next)
		el.loop = !nextOnce
		el.muted = true
		el.autoplay = true
		el.playsInline = true
		el.onended = nextOnce ? handleEnded : undefined
		el.load()

		const onReady = (): void => {
			el.removeEventListener('loadeddata', onReady)
			if (pendingRef.current?.gen !== gen) return // 过期回调作废
			const old = frontRef.current === 0 ? videoARef : videoBRef
			el.classList.add('is-front')
			if (old.current != null && old.current !== el) {
				old.current.classList.remove('is-front')
				try { old.current.pause() } catch { /* 未加载完成时 pause 可能抛错 */ }
			}
			frontRef.current = frontRef.current === 0 ? 1 : 0
			pendingRef.current = null
			// 朝向镜像：方向锁定的步行动画素材本身朝行进方向，跳过镜像
			const p = petRef.current
			const dirLocked = p != null && (next === p.catalog.walkLeft || next === p.catalog.walkRight)
			el.style.transform = (!dirLocked && facingRef.current === 'right') ? 'scaleX(-1)' : ''
			el.play().catch(() => {})
			if (pendingMoveRef.current != null) startMoveDrive(el)
		}
		el.addEventListener('loadeddata', onReady)
		if (el.readyState >= 2) onReady()
	}

	// 状态驱动播放
	useEffect(() => { switchTo(anim, once) }, [anim, once, seq])

	// 卸载清理：停 rAF + 暂停两个视频（停止全部解码）
	useEffect(() => () => {
		stopMove()
		for (const ref of [videoARef, videoBRef]) {
			if (ref.current != null) { try { ref.current.pause() } catch { /* 同上 */ } }
		}
	}, [])

	// 窗口尺寸变化：customPos 按比例跟随（重渲染即可）
	useEffect(() => {
		const onResize = (): void => { setCustomPos((prev) => (prev != null ? { ...prev } : prev)) }
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	// 菜单打开期间：任意指针按下（捕获）或 Esc 关闭
	useEffect(() => {
		if (menu === null) return
		const close = (): void => { setMenu(null) }
		const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close() }
		window.addEventListener('pointerdown', close, true)
		window.addEventListener('keydown', onKey)
		return () => {
			window.removeEventListener('pointerdown', close, true)
			window.removeEventListener('keydown', onKey)
		}
	}, [menu])

	// 设置联动：关漫游立即停移动；隐藏停移动；重置位置令牌
	useEffect(() => { if (!roaming) stopMove() }, [roaming])
	const prevHiddenRef = useRef(settings.hidden)
	useEffect(() => {
		if (prevHiddenRef.current === settings.hidden) return
		prevHiddenRef.current = settings.hidden
		if (settings.hidden) stopMove()
		else setSeq((s) => s + 1) // 重新显示：video 全新元素，重驱动当前动画
	}, [settings.hidden])
	useEffect(() => { stopMove(); setCustomPos(null) }, [settings.resetToken])

	// 动画链：播完按概率选下一个（漫游开：30 待机/10 转向/40 动作/20 移动）
	const pickNext = (): void => {
		const p = petRef.current
		if (p == null) return
		const idle = p.catalog.idle
		const roll = Math.random()
		if (roll < 0.3) {
			setAnim(idle)
		} else if (roll < 0.4) {
			setAnim(pick(p.catalog.turns) || idle)
		} else if (roamingRef.current && roll >= 0.8) {
			if (!tryMove()) setAnim(pick(p.catalog.acts, animRef.current) || idle)
		} else {
			setAnim(pick(p.catalog.acts, animRef.current) || idle)
		}
		setOnce(true)
		setSeq((s) => s + 1)
	}

	const handleEnded = (): void => {
		if (dragRef.current.active) return
		const p = petRef.current
		if (p == null) return
		if (p.catalog.turns.includes(animRef.current)) {
			setFacing((f) => (f === 'left' ? 'right' : 'left'))
		}
		if (animRef.current === p.catalog.drag || p.catalog.clicks.includes(animRef.current)) {
			setAnim(p.catalog.idle) // 用户打断的动画播完 → 先回待机缓冲
			setOnce(true)
			setSeq((s) => s + 1)
			return
		}
		pickNext()
	}

	// ---- 移动系统：动画提供姿态，代码驱动位置（仅漫游时） ----
	const moveRef = useRef<number | null>(null)
	const moveTokenRef = useRef(0)
	const pendingMoveRef = useRef<{ startRatio: number, startYRatio: number, targetRatio: number, dir: number, totalRatio: number } | null>(null)
	const customPosRef = useRef(customPos)
	customPosRef.current = customPos

	const currentCenterX = (): number => {
		const cp = customPosRef.current
		if (cp != null) return cp.rx * window.innerWidth
		const rootEl = rootRef.current
		if (rootEl != null) return rootEl.getBoundingClientRect().left + sizeRef.current / 2
		return window.innerWidth - 24 - sizeRef.current / 2
	}
	const currentCenterY = (): number => {
		const cp = customPosRef.current
		if (cp != null) return cp.ry * window.innerHeight
		const rootEl = rootRef.current
		if (rootEl != null) return rootEl.getBoundingClientRect().top + sizeRef.current / 2
		return window.innerHeight - 20 - sizeRef.current / 2
	}

	/** 位置驱动循环：跟随 video.currentTime 插值，踏步与位移同步不滑步。 */
	const startMoveDrive = (el: HTMLVideoElement): void => {
		const pm = pendingMoveRef.current
		if (pm == null || moveRef.current !== null) return
		pendingMoveRef.current = null
		const { startRatio, startYRatio, targetRatio, dir, totalRatio } = pm
		const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 10.09
		const travelWindow = Math.max(0.1, duration - MOVE_LEAD_SEC - MOVE_TAIL_SEC)
		const token = ++moveTokenRef.current
		const step = (): void => {
			if (moveTokenRef.current !== token) return
			const t = el.currentTime || 0
			const rootEl = rootRef.current
			if (rootEl != null) {
				const W = window.innerWidth
				const H = window.innerHeight
				let ratioX: number
				if (t <= MOVE_LEAD_SEC) ratioX = startRatio
				else if (t >= duration - MOVE_TAIL_SEC) ratioX = targetRatio
				else ratioX = startRatio + dir * totalRatio * ((t - MOVE_LEAD_SEC) / travelWindow)
				// 直接改 DOM style（不触发 React 重渲染，保证 60fps）
				rootEl.style.left = `${ratioX * W - sizeRef.current / 2}px`
				rootEl.style.top = `${startYRatio * H - sizeRef.current / 2}px`
				rootEl.style.right = 'auto'
				rootEl.style.bottom = 'auto'
			}
			if (t < duration - MOVE_TAIL_SEC) {
				moveRef.current = requestAnimationFrame(step)
			} else {
				moveRef.current = null
				setCustomPos({ rx: targetRatio, ry: startYRatio })
			}
		}
		moveRef.current = requestAnimationFrame(step)
	}

	/** 计划一次移动（朝即将生效的 facing 方向）；空间不够返回 false 回退动作。 */
	const tryMove = (): boolean => {
		if (moveRef.current !== null || pendingMoveRef.current != null) return true
		const p = petRef.current
		if (p == null) return false
		const dir = (facingRef.current === 'right') !== p.catalog.turns.includes(animRef.current) ? 1 : -1
		const W = window.innerWidth
		const cx = currentCenterX()
		const distance = randomBetween(MOVE_MIN_PX, MOVE_MAX_PX)
		const target = cx + dir * distance
		const leftBound = MOVE_MARGIN + sizeRef.current / 2
		const rightBound = W - MOVE_MARGIN - sizeRef.current / 2
		if (target < leftBound || target > rightBound) return false
		pendingMoveRef.current = {
			startRatio: cx / W,
			startYRatio: currentCenterY() / window.innerHeight,
			targetRatio: target / W,
			dir,
			totalRatio: Math.abs(target - cx) / W,
		}
		setOnce(true)
		setAnim(dir < 0 ? p.catalog.walkLeft : p.catalog.walkRight)
		return true
	}

	// ---- 点击 vs 拖拽 vs 右键 ----
	const DRAG_THRESHOLD = 5

	const handlePointerDown = (e: React.PointerEvent): void => {
		if (e.button !== 0) return // 右键/中键走菜单逻辑
		e.currentTarget.setPointerCapture(e.pointerId)
		dragRef.current = { active: true, dragging: false, sx: e.clientX, sy: e.clientY }
		stopMove()
	}
	const handlePointerMove = (e: React.PointerEvent): void => {
		const d = dragRef.current
		if (!d.active) return
		const dx = e.clientX - d.sx
		const dy = e.clientY - d.sy
		if (!d.dragging) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
			d.dragging = true
			const p = petRef.current
			if (p != null) { setDragging(true); setOnce(true); setAnim(p.catalog.drag) }
		}
		const rootEl = rootRef.current
		if (rootEl != null) {
			rootEl.style.left = `${e.clientX - sizeRef.current / 2}px`
			rootEl.style.top = `${e.clientY - sizeRef.current / 2}px`
			rootEl.style.right = 'auto'
			rootEl.style.bottom = 'auto'
		}
		const stageEl = stageRef.current
		if (stageEl != null) stageEl.style.transform = 'none' // 拖拽时去掉落地偏移
	}
	const handlePointerUp = (e: React.PointerEvent): void => {
		const d = dragRef.current
		const wasDragging = d.dragging
		d.active = false
		d.dragging = false
		if (wasDragging) {
			justDraggedRef.current = true // 抑制拖拽后的幽灵点击
			setTimeout(() => { justDraggedRef.current = false }, 100)
			setDragging(false)
			setCustomPos({ rx: e.clientX / window.innerWidth, ry: e.clientY / window.innerHeight })
			const stageEl = stageRef.current
			if (stageEl != null) stageEl.style.transform = `translateY(${bottomPadRef.current}px)`
			const p = petRef.current
			if (p != null) { setAnim(p.catalog.idle); setOnce(false) }
		}
	}
	const handleClick = (): void => {
		const d = dragRef.current
		if (d.active || d.dragging || justDraggedRef.current) return
		const p = petRef.current
		if (p == null) return
		if (once && animRef.current !== p.catalog.idle) return // 一次性动画不打断
		stopMove()
		setOnce(true)
		setAnim(pick(p.catalog.clicks) || p.catalog.idle)
	}
	const handleContextMenu = (e: React.MouseEvent): void => {
		e.preventDefault()
		const otherCount = Math.max(0, pets.length - 1)
		const x = Math.min(e.clientX, window.innerWidth - 190)
		const y = Math.min(e.clientY, window.innerHeight - (110 + otherCount * 34))
		setMenu({ x, y })
	}

	// 菜单动作
	const toggleRoaming = (): void => {
		petStore.set({ roaming: !roamingRef.current })
		setMenu(null)
	}
	const resetPosition = (): void => {
		stopMove()
		setCustomPos(null)
		setMenu(null)
	}
	const switchPet = (petId: string): void => {
		petStore.set({ petId }) // Pet 的就绪 effect 处理动画重开局
		setMenu(null)
	}

	// ---- 渲染 ----
	// 落地对齐：舞台下移 size×(canvas.h-feetY)/canvas.h，脚落在视口底线上
	const bottomPad = pet != null ? (size * (pet.canvas.h - pet.feetY)) / pet.canvas.h : 0
	const bottomPadRef = useRef(bottomPad)
	bottomPadRef.current = bottomPad

	const stageStyle = dragging ? { transform: 'none' } : { transform: `translateY(${bottomPad}px)` }
	const rootStyle = customPos != null
		? (() => {
			const half = size / 2
			const left = Math.min(Math.max(customPos.rx * window.innerWidth - half, 0), window.innerWidth - size)
			const top = Math.min(Math.max(customPos.ry * window.innerHeight - half, 0), window.innerHeight - size)
			return { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' }
		})()
		: {}

	const commonVideoProps = {
		muted: true,
		playsInline: true,
		autoPlay: true,
		preload: 'auto',
		onClick: handleClick,
		onPointerDown: handlePointerDown,
		onPointerMove: handlePointerMove,
		onPointerUp: handlePointerUp,
		onPointerCancel: handlePointerUp,
		onContextMenu: handleContextMenu,
		title: 'aqua-pet',
	}

	// 隐藏或宠物未就绪（manifest 未到/无宠物）：整体不渲染
	if (settings.hidden || pet === null) return null

	const menuItems: Array<ReturnType<typeof h>> = [
		h('button', {
			className: 'aqua-pet-menu-item',
			onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); toggleRoaming() },
			children: roaming ? '漫游模式：开（点击关闭）' : '漫游模式：关（点击开启）',
		}),
		h('button', {
			className: 'aqua-pet-menu-item',
			onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); resetPosition() },
			children: '重置位置',
		}),
	]
	if (pets.length > 1) {
		menuItems.push(h('div', { className: 'aqua-pet-menu-sep' }))
		for (const p of pets) {
			if (p.id === pet.id) continue
			menuItems.push(h('button', {
				className: 'aqua-pet-menu-item',
				onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); switchPet(p.id) },
				children: `切换到${p.label}`,
			}))
		}
	}

	return h(react.Fragment, {
		children: [
			h('div', {
				ref: rootRef,
				className: 'aqua-pet-root',
				'data-corner': corner,
				'data-facing': facing,
				style: { '--aqua-pet-size': `${size}px`, ...rootStyle },
				children: h('div', {
					ref: stageRef,
					className: 'aqua-pet-stage',
					style: stageStyle,
					children: [
						h('video', { ...commonVideoProps, ref: videoARef, className: 'aqua-pet-video is-front' }),
						h('video', { ...commonVideoProps, ref: videoBRef, className: 'aqua-pet-video' }),
					],
				}),
			}),
			menu != null ? h('div', {
				className: 'aqua-pet-menu',
				style: { left: `${menu.x}px`, top: `${menu.y}px` },
				children: menuItems,
			}) : null,
		],
	})
}

/**
 * The「桌宠」settings page (settings.section list slot). Shares petStore with
 * the widget: changes apply live and persist to localStorage. The pet
 * selector is the switching surface for installed pet packs.
 */
function AquaPetSettings(): ReturnType<typeof h> {
	const st = usePetState()
	const row = (title: string, desc: string | null, control: ReturnType<typeof h>): ReturnType<typeof h> =>
		h('div', { className: 'aqua-pet-setting-row', children: [
			h('div', { className: 'aqua-pet-setting-label', children: [
				h('span', { className: 'aqua-pet-setting-title', children: title }),
				desc !== null ? h('span', { className: 'aqua-pet-setting-desc', children: desc }) : null,
			] }),
			control,
		] })
	const petOptions = st.pets.map((p) =>
		h('option', { key: p.id, value: p.id, children: `${p.label}（${p.id}）` }))
	return h('div', { className: 'aqua-pet-setting', children: [
		row('显示宠物', '关闭后隐藏宠物并停止全部视频解码（其余设置保留，重新打开即恢复）',
			h('input', { type: 'checkbox', className: 'aqua-pet-setting-check', checked: !st.hidden,
				onChange: (e: React.ChangeEvent<HTMLInputElement>) => petStore.set({ hidden: !e.target.checked }) })),
		row('当前宠物', st.pets.length > 1
			? '切换立即生效；新宠物包放入后重启 dsh web 即出现在这里（右键宠物也可快捷切换）'
			: '目前只安装了一个宠物包；放入更多宠物包后可在这里切换',
			st.pets.length > 0
				? h('select', { className: 'aqua-pet-setting-select', value: st.petId ?? '',
					onChange: (e: React.ChangeEvent<HTMLSelectElement>) => petStore.set({ petId: e.target.value }),
					children: petOptions })
				: h('span', { className: 'aqua-pet-setting-desc', children: '未发现宠物包（manifest 为空）' })),
		row('漫游模式', '开启后宠物会随机起身行走；关闭则停留原地（右键宠物也可快捷切换）',
			h('input', { type: 'checkbox', className: 'aqua-pet-setting-check', checked: st.roaming,
				onChange: (e: React.ChangeEvent<HTMLInputElement>) => petStore.set({ roaming: e.target.checked }) })),
		row('尺寸', '宠物显示高度，拖动实时预览（160–420px）',
			h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [
				h('input', { type: 'range', min: 160, max: 420, step: 10, value: st.size,
					className: 'aqua-pet-setting-range',
					onChange: (e: React.ChangeEvent<HTMLInputElement>) => petStore.set({ size: clampSize(e.target.value) }) }),
				h('span', { className: 'aqua-pet-setting-size-val', children: `${st.size}px` }),
			] })),
		row('默认角落', '未被拖拽或漫游时宠物停靠的角落',
			h('select', { className: 'aqua-pet-setting-select', value: st.corner,
				onChange: (e: React.ChangeEvent<HTMLSelectElement>) => petStore.set({ corner: e.target.value as PetState['corner'] }),
				children: [
					h('option', { value: 'bottom-right', children: '右下角' }),
					h('option', { value: 'bottom-left', children: '左下角' }),
				] })),
		row('位置', '立即把宠物送回默认角落（进行中的漫游移动也会取消）',
			h('button', { className: 'aqua-pet-setting-btn',
				onClick: () => petStore.set({ resetToken: st.resetToken + 1 }), children: '重置位置' })),
	] })
}

/**
 * Register the pet surfaces. Independent of the theme master switch: the pet
 * owns its visibility toggle.
 * @param ctx - client cordis context (ctx.slots).
 */
export function registerAquaPet(ctx: ClientContext): void {
	ctx.slots.inject('shell.overlay', () => ctx.slots.register({
		name: 'shell.overlay',
		id: 'aqua-pet',
		order: 1000,
	}, () => h(Pet)))
	ctx.slots.inject('settings.section', () => ctx.slots.register({
		name: 'settings.section',
		id: 'aqua-pet',
		order: 900,
		label: '桌宠',
	}, () => h(AquaPetSettings)))
}
