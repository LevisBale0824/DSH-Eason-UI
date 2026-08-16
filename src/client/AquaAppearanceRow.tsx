/**
 * Aqua controls block (mode, whale/critters, blur/frost, fluid hue, background
 * brightness, backdrop source, wallpaper picker + crop + fit knobs). Mounted
 * inside the Plugins-section card's collapsible area (`AquaPluginCard`):
 * every write goes straight through to the layer, so the skin moves live.
 * The block renders nothing while the master switch is off.
 */
import { useRef, useState } from 'react'
import { IconCheckOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { fileToDataUrl, Knob, Segmented, uploadWallpaper } from './AquaControls.tsx'
import { AquaWallpaperCrop } from './AquaWallpaperCrop.tsx'
import type { createAquaRowStore } from './settings-store.ts'
import css from './AquaAppearanceRow.module.css'

/** Injected business face: every knob write except the master switch. */
export interface AquaAppearanceRowInjected {
  /** Set the rendering mode. */
  setMode: (value: 'mica' | 'compat') => void
  /** Set the glass blur radius, px. */
  setBlur: (value: number) => void
  /** Set the glass frost amount, 0-100. */
  setFrost: (value: number) => void
  /** Set the fluid hue shift, degrees. */
  setFluidHue: (value: number) => void
  /** Set the background brightness, 0-100 (0 = black, 50 = transparent, 100 = white). */
  setBgBrightness: (value: number) => void
  /** Set the backdrop source. */
  setBackground: (value: 'fluid' | 'wallpaper') => void
  /** Set the wallpaper image (a data URL). */
  setWallpaper: (value: string) => void
  /** Set the particle-whale flag. */
  setWhale: (value: boolean) => void
  /** Set the ambient marine-life flag. */
  setCritters: (value: boolean) => void
  /** Set the wallpaper blur radius, px. */
  setWallpaperBlur: (value: number) => void
  /** Set the wallpaper frost veil, 0-100. */
  setWallpaperFrost: (value: number) => void
  /** Set the wallpaper fit (cover / contain / fill). */
  setWallpaperFit: (value: 'cover' | 'contain' | 'fill') => void
  /** Set the wallpaper zoom, 100-300. */
  setWallpaperScale: (value: number) => void
  /** Set the wallpaper focal-point X, 0-100. */
  setWallpaperPosX: (value: number) => void
  /** Set the wallpaper focal-point Y, 0-100. */
  setWallpaperPosY: (value: number) => void
}

/** Full component props: locale seat + store share + injected face. */
export type AquaAppearanceRowComponentProps =
  PropsLocale<'settings.aqua'> & PropsStore<ReturnType<typeof createAquaRowStore>>
  & AquaAppearanceRowInjected & { embedded?: boolean }

/**
 * Render the Aqua controls block.
 * @param props - locale + store + setters, plus `embedded` (inside the plugin card).
 * @returns the controls, or nothing while the master switch is off.
 */
export function AquaAppearanceRow(props: AquaAppearanceRowComponentProps) {
  const {
    t, setMode, setBlur, setFrost, setFluidHue, setBgBrightness,
    setBackground, setWallpaper, setWhale, setCritters, setWallpaperBlur, setWallpaperFrost,
    setWallpaperFit, setWallpaperScale, setWallpaperPosX, setWallpaperPosY, useStore, embedded,
  } = props
  const enabled = useStore(s => s.enabled)
  const mode = useStore(s => s.mode)
  const blur = useStore(s => s.blur)
  const frost = useStore(s => s.frost)
  const fluidHue = useStore(s => s.fluidHue)
  const bgBrightness = useStore(s => s.bgBrightness)
  const dark = useStore(s => s.dark)
  const background = useStore(s => s.background)
  const whale = useStore(s => s.whale)
  const critters = useStore(s => s.critters)
  const wallpaper = useStore(s => s.wallpaper)
  const wallpaperBlur = useStore(s => s.wallpaperBlur)
  const wallpaperFrost = useStore(s => s.wallpaperFrost)
  const wallpaperFit = useStore(s => s.wallpaperFit)
  const wallpaperScale = useStore(s => s.wallpaperScale)
  const wallpaperPosX = useStore(s => s.wallpaperPosX)
  const wallpaperPosY = useStore(s => s.wallpaperPosY)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  // The brightness knob only ever offers the half that makes sense for the
  // resolved scheme: dark mode darkens (0-50), light mode brightens (50-100).
  // The stored 0-100 value is clamped for display; writing always stays in
  // the offered range, so a value picked in one scheme is inert in the other.
  const bgMin = dark ? 0 : 50
  const bgMax = dark ? 50 : 100
  const bgDisplay = Math.min(bgMax, Math.max(bgMin, bgBrightness))

  // Off = the Plugins master switch is off: leave no trace in General.
  if (!enabled) return null

  return (
    <div className={embedded ? css.embedded : css.group}>
      <div className={css.controls}>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.mode')}</span>
          <Segmented
            label={t('aqua.mode')}
            value={mode}
            options={[
              { id: 'mica', label: t('aqua.modeMica') },
              { id: 'compat', label: t('aqua.modeCompat') },
            ]}
            onSelect={setMode}
          />
        </div>
        <div className={css.rowHint}>{t('aqua.modeHint')}</div>

        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.whale')}</span>
          <button
            type="button"
            className={whale ? css.toggleOn : css.toggle}
            aria-pressed={whale}
            onClick={() => { setWhale(!whale) }}
          >
            <span className={css.check}>
              {whale && <IconCheckOutline16 />}
            </span>
            {whale ? t('aqua.enable') : t('aqua.disable')}
          </button>
          <span className={css.inlineLabel}>{t('aqua.critters')}</span>
          <button
            type="button"
            className={critters ? css.toggleOn : css.toggle}
            aria-pressed={critters}
            onClick={() => { setCritters(!critters) }}
          >
            <span className={css.check}>
              {critters && <IconCheckOutline16 />}
            </span>
            {critters ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>

        {mode === 'mica' && (
          <>
            <Knob label={t('aqua.blur')} value={blur} min={0} max={40} step={0.5} unit="px" onChange={setBlur} />
            <Knob label={t('aqua.frost')} value={frost} min={0} max={100} step={1} unit="%" onChange={setFrost} />
          </>
        )}
        <Knob label={t('aqua.fluidHue')} value={fluidHue} min={0} max={360} step={1} unit="°" onChange={setFluidHue} />
        <Knob label={t('aqua.bgBrightness')} value={bgDisplay} min={bgMin} max={bgMax} step={1} unit="%" onChange={setBgBrightness} />
        <div className={css.knobHint}>
          {t(dark ? 'aqua.bgBrightnessHintDark' : 'aqua.bgBrightnessHintLight')}
        </div>

        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.background')}</span>
          <Segmented
            label={t('aqua.background')}
            value={background}
            options={[
              { id: 'fluid', label: t('aqua.backgroundFluid') },
              { id: 'wallpaper', label: t('aqua.backgroundWallpaper') },
            ]}
            onSelect={setBackground}
          />
        </div>

        {background === 'wallpaper' && (
          <>
            <div className={css.row}>
              <span className={css.rowLabel}>{t('aqua.wallpaper')}</span>
              <div className={css.wallpaperPick}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className={css.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file !== undefined) {
                      // Original bytes first (host store, lossless); the
                      // compressed data URL only serves hosts without the
                      // route. The stored value becomes a short URL instead
                      // of a megabyte base64 string. A host upload also opens
                      // the crop editor — pick, frame, done.
                      void uploadWallpaper(file)
                        .then((url) => {
                          if (url !== undefined) setCropOpen(true)
                          return url ?? fileToDataUrl(file)
                        })
                        .then(setWallpaper)
                        .catch(() => {})
                    }
                    e.target.value = ''
                  }}
                />
                <button type="button" className={css.pickButton} onClick={() => { fileRef.current?.click() }}>
                  {t('aqua.chooseWallpaper')}
                </button>
                {wallpaper !== '' && (
                  <button
                    type="button"
                    className={css.pickButton}
                    onClick={() => { setCropOpen(true) }}
                  >
                    {t('aqua.cropWallpaper')}
                  </button>
                )}
                {wallpaper !== '' && (
                  <button
                    type="button"
                    className={css.deleteButton}
                    onClick={() => {
                      // Best effort: clear the host-side original too.
                      void fetch('/aqua-wallpaper/img', { method: 'DELETE' }).catch(() => {})
                      setWallpaper('')
                    }}
                  >
                    {t('aqua.deleteWallpaper')}
                  </button>
                )}
              </div>
            </div>
            <div className={css.knobHint}>{t('aqua.wallpaperHint')}</div>
            {wallpaper !== '' && (
              <>
                <div className={css.row}>
                  <span className={css.rowLabel}>{t('aqua.wallpaperFit')}</span>
                  <Segmented
                    label={t('aqua.wallpaperFit')}
                    value={wallpaperFit}
                    options={[
                      { id: 'cover', label: t('aqua.wallpaperFitCover') },
                      { id: 'contain', label: t('aqua.wallpaperFitContain') },
                      { id: 'fill', label: t('aqua.wallpaperFitFill') },
                    ]}
                    onSelect={setWallpaperFit}
                  />
                </div>
                <div className={css.rowHint}>{t('aqua.wallpaperFitHint')}</div>
                <Knob label={t('aqua.wallpaperScale')} value={wallpaperScale} min={100} max={300} step={1} unit="%" onChange={setWallpaperScale} />
                <Knob label={t('aqua.wallpaperPosX')} value={wallpaperPosX} min={0} max={100} step={1} unit="%" onChange={setWallpaperPosX} />
                <Knob label={t('aqua.wallpaperPosY')} value={wallpaperPosY} min={0} max={100} step={1} unit="%" onChange={setWallpaperPosY} />
              </>
            )}
            <Knob label={t('aqua.wallpaperBlur')} value={wallpaperBlur} min={0} max={40} step={0.5} unit="px" onChange={setWallpaperBlur} />
            <Knob label={t('aqua.wallpaperFrost')} value={wallpaperFrost} min={0} max={100} step={1} unit="%" onChange={setWallpaperFrost} />
          </>
        )}
      </div>
      {background === 'wallpaper' && cropOpen && wallpaper !== '' && (
        <AquaWallpaperCrop
          title={t('aqua.cropTitle')}
          hint={t('aqua.cropHint')}
          resetLabel={t('aqua.cropReset')}
          cancelLabel={t('aqua.cropCancel')}
          applyLabel={t('aqua.cropApply')}
          zoomLabel={t('aqua.cropZoom')}
          unsupported={t('aqua.cropUnsupported')}
          sourceUrl={wallpaper}
          onApply={(url) => {
            setWallpaper(url)
            // The crop matches the screen ratio exactly — cover shows it
            // edge-to-edge with zero further cropping.
            setWallpaperFit('cover')
          }}
          onClose={() => { setCropOpen(false) }}
        />
      )}
    </div>
  )
}
