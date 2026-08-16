/**
 * Aqua client plugin body: the toggleable glassmorphism skin. Owns the durable
 * enable flag (localStorage), applies/retracts the theme layer through
 * {@link AquaLayer}, and registers one settings surface:
 * - the Plugins-section card (`settings.plugin.item`): the master on/off
 *   switch plus a collapse area with every glass knob (mode, whale/critters,
 *   blur/frost, fluid hue, brightness, backdrop, wallpaper + crop).
 * One click on the master switch returns the stock UI (every layer is an
 * effect, disposed on flip).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import './aqua.module.css';
import './fonts.module.css';
/** Required services: theme override stack plus the settings-card surfaces. */
export declare const inject: string[];
/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map