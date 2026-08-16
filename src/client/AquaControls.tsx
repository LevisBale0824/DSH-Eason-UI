/**
 * Shared controls for the Aqua General-settings appearance row: the Knob
 * (stepless slider + number box), a two-option Segmented picker, and the
 * wallpaper file reader. Kept in one file so the row stays a single surface.
 */
import css from './AquaAppearanceRow.module.css'

/** One slider + number box, wired to a single value. */
export interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}

/** Render one knob row. */
export function Knob({ label, value, min, max, step, unit, onChange }: KnobProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))
  return (
    <label className={css.knob}>
      <span className={css.knobLabel}>{label}</span>
      <input
        type="range"
        className={css.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { onChange(clamp(Number(e.target.value))) }}
      />
      <span className={css.numberWrap}>
        <input
          type="number"
          className={css.number}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => { onChange(clamp(Number(e.target.value))) }}
        />
        <span className={css.unit}>{unit}</span>
      </span>
    </label>
  )
}

/** One segment of a Segmented picker. */
export interface SegmentedOption<T extends string> {
  id: T
  label: string
}

export interface SegmentedProps<T extends string> {
  /** Accessible name for the button group. */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onSelect: (value: T) => void
}

/** Render a two-button segmented picker. */
export function Segmented<T extends string>({ label, value, options, onSelect }: SegmentedProps<T>) {
  return (
    <div className={css.segmented} role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? css.segActive : css.seg}
          aria-pressed={option.id === value}
          onClick={() => { onSelect(option.id) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Upload the picked image to the host wallpaper store (route served by the
 *  node half): the ORIGINAL bytes land on disk and are served back by URL —
 *  no downscale, no re-encode, no localStorage quota. Returns undefined when
 *  the route is missing (old host) so the caller can fall back to the
 *  compressed data URL. */
export async function uploadWallpaper(file: File): Promise<string | undefined> {
  try {
    const res = await fetch('/aqua-wallpaper/img', {
      method: 'PUT',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!res.ok) return undefined
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return undefined
    const url = (data as { url?: unknown }).url
    return typeof url === 'string' && url !== '' ? url : undefined
  } catch {
    return undefined
  }
}

/** Upload the crop editor's output to the host store: only the display file
 *  (`wallpaper.<ext>`) moves — the untouched `original.<ext>` survives so
 *  re-cropping never costs a generation. Returns the new display URL, or
 *  undefined when the route is missing (old host). */
export async function uploadWallpaperCropped(blob: Blob): Promise<string | undefined> {
  try {
    const res = await fetch('/aqua-wallpaper/cropped', {
      method: 'PUT',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    })
    if (!res.ok) return undefined
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return undefined
    const url = (data as { url?: unknown }).url
    return typeof url === 'string' && url !== '' ? url : undefined
  } catch {
    return undefined
  }
}

/** Read a file, downscale to at most the physical screen, and return a JPEG
 *  data URL. Only the fallback path for hosts without the wallpaper route —
 *  the primary path stores the original losslessly server-side. */
export async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { resolve(String(reader.result)) }
    reader.onerror = () => { reject(reader.error) }
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => { resolve(im) }
    im.onerror = () => { reject(new Error('image load failed')) }
    im.src = raw
  })
  // Cap at the physical screen (CSS pixels × devicePixelRatio, ≥1920): big
  // enough that a fullscreen render never upscales the bitmap.
  const dpr = window.devicePixelRatio || 1
  const screenLong = Math.max(window.screen.width, window.screen.height) * dpr
  const cap = Math.max(1920, Math.round(screenLong))
  const scale = Math.min(1, cap / Math.max(image.width, image.height))
  const w = Math.max(1, Math.round(image.width * scale))
  const h = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx === null) return raw
  ctx.drawImage(image, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.92)
}
