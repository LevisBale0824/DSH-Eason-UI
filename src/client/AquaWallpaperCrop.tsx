/**
 * Interactive wallpaper crop editor: a fixed-ratio viewport (the screen's
 * aspect) floats over the image — drag to pan the composition, wheel or the
 * slider to zoom, Apply crops at the image's natural resolution and uploads
 * the result losslessly (WebP lossless, PNG fallback). The host keeps the
 * untouched original, so re-cropping never costs a generation of quality.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { uploadWallpaperCropped } from './AquaControls.tsx'
import css from './AquaWallpaperCrop.module.css'

/** Props: locale strings + the image source + apply/close callbacks. */
export interface AquaWallpaperCropProps {
  title: string
  hint: string
  resetLabel: string
  cancelLabel: string
  applyLabel: string
  zoomLabel: string
  unsupported: string
  /** Current wallpaper value (URL or data URL); host URLs are swapped for the untouched original. */
  sourceUrl: string
  /** Fired with the new display URL after a successful crop upload. */
  onApply: (url: string) => void
  onClose: () => void
}

/** Zoom range: 1 = exactly covering the crop viewport, 4 = 4× in. */
const MIN_ZOOM = 1
const MAX_ZOOM = 4

/** Encode the crop losslessly: WebP lossless first, PNG fallback, JPEG 0.95 only if PNG is huge. */
async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/webp', 1) })
  if (webp !== null && webp.type === 'image/webp') return webp
  const png = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/png') })
  if (png !== null && png.size <= 30 * 1024 * 1024) return png ?? webp!
  const jpg = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/jpeg', 0.95) })
  return jpg ?? png ?? webp!
}

/** Everything the geometry needs per render, mirrored into a ref for handlers. */
interface Geometry {
  cw: number
  ch: number
  vw: number
  vh: number
  vx: number
  vy: number
  coverScale: number
  z: number
  w: number
  h: number
  ix: number
  iy: number
  maxPanX: number
  maxPanY: number
}

/**
 * Render the crop editor overlay.
 * @param props - locale strings, image source, callbacks.
 * @returns the modal, or nothing while the source resolves.
 */
export function AquaWallpaperCrop(props: AquaWallpaperCropProps) {
  const { title, hint, resetLabel, cancelLabel, applyLabel, zoomLabel, unsupported, sourceUrl, onApply, onClose } = props

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const geoRef = useRef<Geometry | null>(null)
  const dragRef = useRef<{ id: number, x: number, y: number, panX: number, panY: number } | null>(null)

  const [imgSrc, setImgSrc] = useState(sourceUrl)
  const [dims, setDims] = useState<{ iw: number, ih: number } | null>(null)
  const [box, setBox] = useState<{ cw: number, ch: number } | null>(null)
  const [view, setView] = useState({ zoom: MIN_ZOOM, panX: 0, panY: 0 })
  const [busy, setBusy] = useState(false)
  const [showUnsupported, setShowUnsupported] = useState(false)

  // The screen's aspect at open time — the crop frame's fixed ratio.
  const [aspect] = useState(() => {
    const ratio = window.innerWidth / Math.max(1, window.innerHeight)
    return Math.min(3.5, Math.max(0.3, ratio))
  })

  // Prefer the host's untouched original (re-crop never degrades).
  useEffect(() => {
    if (!sourceUrl.startsWith('/aqua-wallpaper/')) {
      setImgSrc(sourceUrl)
      return
    }
    let alive = true
    void (async () => {
      try {
        const res = await fetch('/aqua-wallpaper/current')
        if (!res.ok) return
        const data = await res.json() as { originalUrl?: unknown }
        if (alive && typeof data.originalUrl === 'string' && data.originalUrl !== '') setImgSrc(data.originalUrl)
      } catch {
        /* keep the display URL as the source */
      }
    })()
    return () => { alive = false }
  }, [sourceUrl])

  // Measure the stage (ResizeObserver keeps it correct through dialog resizes).
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el === null) return
    const measure = (): void => { setBox({ cw: el.clientWidth, ch: el.clientHeight }) }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => { ro.disconnect() }
  }, [])

  // Wheel zoom (non-passive so the page never scrolls underneath).
  useEffect(() => {
    const el = bodyRef.current
    if (el === null) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView(v => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [])

  // ---- Geometry (recomputed every render, mirrored to refs for handlers) ----
  let geo: Geometry | null = null
  if (box !== null && dims !== null && box.cw > 0 && box.ch > 0 && dims.iw > 0 && dims.ih > 0) {
    const { cw, ch } = box
    const pad = 0.86
    let vw = Math.min(cw * pad, ch * pad * aspect)
    let vh = vw / aspect
    if (vh > ch * pad) {
      vh = ch * pad
      vw = vh * aspect
    }
    const vx = (cw - vw) / 2
    const vy = (ch - vh) / 2
    const coverScale = Math.max(vw / dims.iw, vh / dims.ih)
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom))
    const w = dims.iw * coverScale * z
    const h = dims.ih * coverScale * z
    const maxPanX = (w - vw) / 2
    const maxPanY = (h - vh) / 2
    const panX = Math.min(maxPanX, Math.max(-maxPanX, view.panX))
    const panY = Math.min(maxPanY, Math.max(-maxPanY, view.panY))
    geo = {
      cw, ch, vw, vh, vx, vy, coverScale, z, w, h,
      ix: vx + (vw - w) / 2 + panX,
      iy: vy + (vh - h) / 2 + panY,
      maxPanX, maxPanY,
    }
  }
  useEffect(() => { geoRef.current = geo })
  const zPct = geo === null ? 100 : Math.round(geo.z * 100)

  // ---- Drag to pan ----
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const g = geoRef.current
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      panX: g === null ? 0 : clampPan(geoViewPanX(g), g.maxPanX),
      panY: g === null ? 0 : clampPan(geoViewPanY(g), g.maxPanY),
    }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current
    const g = geoRef.current
    if (d === null || g === null || d.id !== e.pointerId) return
    setView({
      zoom: g.z,
      panX: clampPan(d.panX + (e.clientX - d.x), g.maxPanX),
      panY: clampPan(d.panY + (e.clientY - d.y), g.maxPanY),
    })
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null
  }

  // ---- Apply: crop at natural resolution, upload losslessly ----
  const apply = useCallback(async () => {
    const im = imgRef.current
    const g = geoRef.current
    if (im === null || g === null || dims === null || busy) return
    setBusy(true)
    try {
      const s = g.w / dims.iw
      const sx = clamp((g.vx - g.ix) / s, 0, dims.iw - g.vw / s)
      const sy = clamp((g.vy - g.iy) / s, 0, dims.ih - g.vh / s)
      const rx = Math.round(sx)
      const ry = Math.round(sy)
      const rw = Math.min(Math.round(g.vw / s), dims.iw - rx)
      const rh = Math.min(Math.round(g.vh / s), dims.ih - ry)
      if (rw < 1 || rh < 1) return
      const canvas = document.createElement('canvas')
      canvas.width = rw
      canvas.height = rh
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      ctx.drawImage(im, rx, ry, rw, rh, 0, 0, rw, rh)
      const blob = await canvasToBlob(canvas)
      const url = await uploadWallpaperCropped(blob)
      if (url === undefined) {
        setShowUnsupported(true)
        return
      }
      onApply(url)
      onClose()
    } finally {
      setBusy(false)
    }
  }, [busy, dims, onApply, onClose])

  const outW = geo === null || dims === null ? 0 : Math.round((geo.vw * dims.iw) / geo.w)
  const outH = geo === null || dims === null ? 0 : Math.round((geo.vh * dims.ih) / geo.h)

  return (
    <div
      className={css.overlay}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <div className={css.dialog} role="dialog" aria-label={title}>
        <div className={css.header}>
          <span className={css.title}>{title}</span>
          <span className={css.headerHint}>{hint}</span>
        </div>
        <div ref={bodyRef} className={css.body}>
          {geo !== null && (
            <>
              <div
                className={css.stage}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt=""
                  draggable={false}
                  className={css.img}
                  style={{ left: `${geo.ix}px`, top: `${geo.iy}px`, width: `${geo.w}px`, height: `${geo.h}px` }}
                  onLoad={(e) => { setDims({ iw: e.currentTarget.naturalWidth, ih: e.currentTarget.naturalHeight }) }}
                  onError={() => { setDims(null) }}
                />
              </div>
              <div
                className={css.frame}
                style={{ left: `${geo.vx}px`, top: `${geo.vy}px`, width: `${geo.vw}px`, height: `${geo.vh}px` }}
              >
                <span className={css.sizeTag}>{outW}×{outH}</span>
              </div>
            </>
          )}
          {dims === null && <div className={css.loading}>{hint}</div>}
        </div>
        <div className={css.footer}>
          <label className={css.zoomWrap}>
            <span className={css.zoomLabel}>{zoomLabel}</span>
            <input
              type="range"
              className={css.zoomSlider}
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              step={1}
              value={zPct}
              onChange={(e) => { setView(v => ({ ...v, zoom: Number(e.target.value) / 100 })) }}
            />
            <span className={css.zoomValue}>{zPct}%</span>
          </label>
          <button type="button" className={css.btn} onClick={() => { setView({ zoom: MIN_ZOOM, panX: 0, panY: 0 }) }}>
            {resetLabel}
          </button>
          <button type="button" className={css.btn} onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={css.btnPrimary} onClick={() => { void apply() }} disabled={busy || geo === null}>
            {applyLabel}
          </button>
        </div>
        {showUnsupported && <div className={css.unsupported}>{unsupported}</div>}
      </div>
    </div>
  )
}

/** Clamp helper. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Read the effective pan back out of a rendered geometry (center-anchored). */
function geoViewPanX(g: Geometry): number {
  return g.ix - (g.vx + (g.vw - g.w) / 2)
}

function geoViewPanY(g: Geometry): number {
  return g.iy - (g.vy + (g.vh - g.h) / 2)
}

function clampPan(n: number, max: number): number {
  return clamp(n, -max, max)
}
