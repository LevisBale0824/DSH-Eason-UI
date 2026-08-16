/** One slider + number box, wired to a single value. */
export interface KnobProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (value: number) => void;
}
/** Render one knob row. */
export declare function Knob({ label, value, min, max, step, unit, onChange }: KnobProps): import("react").JSX.Element;
/** One segment of a Segmented picker. */
export interface SegmentedOption<T extends string> {
    id: T;
    label: string;
}
export interface SegmentedProps<T extends string> {
    /** Accessible name for the button group. */
    label: string;
    value: T;
    options: readonly SegmentedOption<T>[];
    onSelect: (value: T) => void;
}
/** Render a two-button segmented picker. */
export declare function Segmented<T extends string>({ label, value, options, onSelect }: SegmentedProps<T>): import("react").JSX.Element;
/** Upload the picked image to the host wallpaper store (route served by the
 *  node half): the ORIGINAL bytes land on disk and are served back by URL —
 *  no downscale, no re-encode, no localStorage quota. Returns undefined when
 *  the route is missing (old host) so the caller can fall back to the
 *  compressed data URL. */
export declare function uploadWallpaper(file: File): Promise<string | undefined>;
/** Upload the crop editor's output to the host store: only the display file
 *  (`wallpaper.<ext>`) moves — the untouched `original.<ext>` survives so
 *  re-cropping never costs a generation. Returns the new display URL, or
 *  undefined when the route is missing (old host). */
export declare function uploadWallpaperCropped(blob: Blob): Promise<string | undefined>;
/** Read a file, downscale to at most the physical screen, and return a JPEG
 *  data URL. Only the fallback path for hosts without the wallpaper route —
 *  the primary path stores the original losslessly server-side. */
export declare function fileToDataUrl(file: File): Promise<string>;
//# sourceMappingURL=AquaControls.d.ts.map