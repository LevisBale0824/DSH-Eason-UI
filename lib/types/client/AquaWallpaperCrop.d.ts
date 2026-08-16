/** Props: locale strings + the image source + apply/close callbacks. */
export interface AquaWallpaperCropProps {
    title: string;
    hint: string;
    resetLabel: string;
    cancelLabel: string;
    applyLabel: string;
    zoomLabel: string;
    unsupported: string;
    /** Current wallpaper value (URL or data URL); host URLs are swapped for the untouched original. */
    sourceUrl: string;
    /** Fired with the new display URL after a successful crop upload. */
    onApply: (url: string) => void;
    onClose: () => void;
}
/**
 * Render the crop editor overlay.
 * @param props - locale strings, image source, callbacks.
 * @returns the modal, or nothing while the source resolves.
 */
export declare function AquaWallpaperCrop(props: AquaWallpaperCropProps): import("react").JSX.Element;
//# sourceMappingURL=AquaWallpaperCrop.d.ts.map