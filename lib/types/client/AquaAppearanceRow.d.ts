import type { PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { createAquaRowStore } from './settings-store.ts';
/** Injected business face: every knob write except the master switch. */
export interface AquaAppearanceRowInjected {
    /** Set the rendering mode. */
    setMode: (value: 'mica' | 'compat') => void;
    /** Set the glass blur radius, px. */
    setBlur: (value: number) => void;
    /** Set the glass frost amount, 0-100. */
    setFrost: (value: number) => void;
    /** Set the fluid hue shift, degrees. */
    setFluidHue: (value: number) => void;
    /** Set the background brightness, 0-100 (0 = black, 50 = transparent, 100 = white). */
    setBgBrightness: (value: number) => void;
    /** Set the backdrop source. */
    setBackground: (value: 'fluid' | 'wallpaper') => void;
    /** Set the wallpaper image (a data URL). */
    setWallpaper: (value: string) => void;
    /** Set the particle-whale flag. */
    setWhale: (value: boolean) => void;
    /** Set the ambient marine-life flag. */
    setCritters: (value: boolean) => void;
    /** Set the wallpaper blur radius, px. */
    setWallpaperBlur: (value: number) => void;
    /** Set the wallpaper frost veil, 0-100. */
    setWallpaperFrost: (value: number) => void;
    /** Set the wallpaper fit (cover / contain / fill). */
    setWallpaperFit: (value: 'cover' | 'contain' | 'fill') => void;
    /** Set the wallpaper zoom, 100-300. */
    setWallpaperScale: (value: number) => void;
    /** Set the wallpaper focal-point X, 0-100. */
    setWallpaperPosX: (value: number) => void;
    /** Set the wallpaper focal-point Y, 0-100. */
    setWallpaperPosY: (value: number) => void;
}
/** Full component props: locale seat + store share + injected face. */
export type AquaAppearanceRowComponentProps = PropsLocale<'settings.aqua'> & PropsStore<ReturnType<typeof createAquaRowStore>> & AquaAppearanceRowInjected & {
    embedded?: boolean;
};
/**
 * Render the Aqua controls block.
 * @param props - locale + store + setters, plus `embedded` (inside the plugin card).
 * @returns the controls, or nothing while the master switch is off.
 */
export declare function AquaAppearanceRow(props: AquaAppearanceRowComponentProps): import("react").JSX.Element | null;
//# sourceMappingURL=AquaAppearanceRow.d.ts.map