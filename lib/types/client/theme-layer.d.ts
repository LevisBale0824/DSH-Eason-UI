/**
 * Aqua theme layer: one toggleable visual skin over the whole Web surface.
 * Everything this layer owns is an effect — token overrides ride the theme
 * service's override stack, the CSS hooks ride a `data-dsh-aqua` attribute on
 * <html> (the stylesheet only applies under it), the ambient scene and page
 * fades are mounted/removed with the layer — so switching the flag off (or
 * unloading the plugin) restores the stock UI exactly: no residue, no reload.
 *
 * The enable flag persists in localStorage: a client-only visual preference
 * (like the selected-session key), written and read by this plugin alone.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client';
/** html attribute selecting the Aqua layer: CSS hooks and ambient effects. */
export declare const AQUA_ATTRIBUTE = "data-dsh-aqua";
/** localStorage key carrying the layer enable flag. */
export declare const AQUA_ENABLED_KEY = "dsh.ui-aqua.enabled";
/** Default state when nothing is stored yet: on. */
export declare const DEFAULT_ENABLED = true;
/**
 * Alias-token override layer: the deep-sea palette. Every value is a
 * `{ light, dark }` pair so the layer stays legible when the user switches
 * the Appearance preference — dark is deep-sea navy, light is cool white-blue.
 */
export declare const AQUA_TOKEN_OVERRIDES: ThemeTokenOverrides;
/** Tunable layer knobs, persisted independently of the enable flag. */
export interface AquaSettings {
    /** Rendering mode: mica (frosted floating cards) or the stock layout with a generic glass material. */
    mode: 'mica' | 'compat';
    /** Glass backdrop blur radius, px. */
    blur: number;
    /** Glass fill opacity, 0-100 (50 = the shipped look; drives the frost multiplier). */
    frost: number;
    /** Fluid hue shift, degrees. */
    fluidHue: number;
    /** Background brightness, 0-100 (0 = pure black, 50 = transparent, 100 = pure white). */
    bgBrightness: number;
    /** Backdrop source: the living fluid board or a custom wallpaper. */
    background: 'fluid' | 'wallpaper';
    /** Wallpaper image data URL (empty until one is picked). */
    wallpaper: string;
    /** Particle whale in the chat area center (the harness hero fish). */
    whale: boolean;
    /** Ambient marine life (fish / bubbles / plankton). */
    critters: boolean;
    /** Wallpaper blur radius, px. */
    wallpaperBlur: number;
    /** Wallpaper frost veil, 0-100. */
    wallpaperFrost: number;
    /** Wallpaper fit: cover (crop to fill), contain (letterbox), fill (stretch). */
    wallpaperFit: 'cover' | 'contain' | 'fill';
    /** Wallpaper zoom, 100-300 (% of the fitted size, around the focal point). */
    wallpaperScale: number;
    /** Wallpaper focal-point X, 0-100 (%). */
    wallpaperPosX: number;
    /** Wallpaper focal-point Y, 0-100 (%). */
    wallpaperPosY: number;
}
/**
 * Owns the Aqua layer lifecycle: reads the durable enable flag, and applies /
 * retracts every layer on change. Cross-tab flips arrive through the storage
 * event; every subscription and mounted effect are released when the plugin
 * fiber is disposed.
 */
export declare class AquaLayer {
    private enabled;
    private settings;
    /** Resolved palette scheme: dark = the brightness knob darkens, light = it brightens. */
    private dark;
    private tokenDisposer;
    private mainFluid;
    private interactionDisposer;
    private themeListener;
    private seamDisposer;
    private whaleHandle;
    private readonly ctx;
    /**
     * @param ctx - owning client context.
     */
    constructor(ctx: Context);
    /** Current enable state (the settings row mirrors this). */
    getEnabled(): boolean;
    /** Probe the host wallpaper store; adopt its URL when one exists. */
    private probeHostWallpaper;
    /** Current knob values (the settings row mirrors these). */
    getSettings(): AquaSettings;
    /** Whether the resolved palette is dark (the brightness knob darkens). */
    getDark(): boolean;
    /** Resolved scheme from the theme service (falls back to the body attribute). */
    private resolveScheme;
    /** Re-read every knob from localStorage into memory. */
    private reloadSettings;
    /** Flip the layer: persist, then apply or retract every owned effect. */
    setEnabled(value: boolean): void;
    /** Set the rendering mode ('mica' or 'compat'). */
    setMode(value: 'mica' | 'compat'): void;
    /** Set the glass blur radius (px). */
    setBlur(value: number): void;
    /** Set the glass frost amount (0-100). */
    setFrost(value: number): void;
    /** Set the fluid hue shift (degrees). */
    setFluidHue(value: number): void;
    /** Set the background brightness (0-100: 0 = pure black, 50 = transparent, 100 = pure white). */
    setBgBrightness(value: number): void;
    /** Set the backdrop source (fluid board or custom wallpaper). */
    setBackground(value: 'fluid' | 'wallpaper'): void;
    /** Set the wallpaper image (a data URL; empty clears it). */
    setWallpaper(value: string): void;
    /** Set the particle-whale flag (chat-area center decoration). */
    setWhale(value: boolean): void;
    /** Set the ambient marine-life flag (fish / bubbles / plankton). */
    setCritters(value: boolean): void;
    /** Set the wallpaper blur radius (px). */
    setWallpaperBlur(value: number): void;
    /** Set the wallpaper frost veil (0-100). */
    setWallpaperFrost(value: number): void;
    /** Set the wallpaper fit (cover = crop-fill, contain = letterbox, fill = stretch). */
    setWallpaperFit(value: 'cover' | 'contain' | 'fill'): void;
    /** Set the wallpaper zoom (100-300, % of the fitted size). */
    setWallpaperScale(value: number): void;
    /** Set the wallpaper focal-point X (0-100, %; the crop/zoom anchor). */
    setWallpaperPosX(value: number): void;
    /** Set the wallpaper focal-point Y (0-100, %; the crop/zoom anchor). */
    setWallpaperPosY(value: number): void;
    private sync;
    /** Write the knob-driven CSS variables and mode attributes onto <html>. */
    private applySettings;
    /** Apply the mode's token layer (floating palette, or translucent compat). */
    private applyTokens;
    private mount;
    /** Mount or drop the particle whale to match enabled + the whale flag. */
    private syncWhale;
    private unmount;
    /** Attach the fluid shader and the interaction feeds. */
    private mountFluid;
    private teardownFluid;
    private fluidParams;
    private applyFluidPalettes;
    /** Stamp the data-* seams the stylesheet keys off (self-contained mode). */
    private startSeamStamper;
}
//# sourceMappingURL=theme-layer.d.ts.map