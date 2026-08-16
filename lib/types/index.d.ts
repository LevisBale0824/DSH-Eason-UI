import type { Context } from '@deepseek-ai/cordis';
/** Plugin row id (matches cordis.patch.yml). */
export declare const name = "ui-aqua";
/** Required services: the web server route registry. */
export declare const inject: string[];
/** Host plugin config (from the patch tree). */
export interface Config {
    /** Overrides the wallpaper store (default `$DSH_HOME/aqua-wallpaper`). */
    wallpaperRoot?: string;
}
/**
 * Host plugin body: register the `/aqua-wallpaper` store route.
 * @param ctx - plugin context; ctx.webServer is the web server service.
 * @param config - this row's config (from the patch tree).
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map