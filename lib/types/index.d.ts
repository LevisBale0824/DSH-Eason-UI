/**
 * Aqua theme + pet plugin, node half. The browser half (exports["./client"])
 * owns the glassmorphism skin and the desktop pet widget; this node half
 * serves pet animation assets over the `/aqua-pet` prefix route and exposes
 * the multi-pet manifest. Pet packs are directory-driven (see
 * assets/pets/pet.schema.md) — adding or switching pets never touches code.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';

/** Plugin row id (matches cordis.patch.yml). */
export declare const name = 'ui-aqua';
/** Required services: the web server route registry. */
export declare const inject: string[];

/** Host plugin config (from the patch tree). */
export interface Config {
    /** Extra pet root directories (absolute), scanned after the package root. */
    extraPetRoots?: string[];
    /** Overrides the user drop zone (default `$DSH_HOME/aqua-pets`). */
    homeRoot?: string;
}

/** A parsed pet.json descriptor (contract: assets/pets/pet.schema.md). */
export interface PetDescriptor {
    id: string;
    label: string;
    description?: string;
    order?: number;
    canvas: { w: number; h: number };
    feetY: number;
    catalog: {
        idle: string;
        turns: string[];
        acts: string[];
        clicks: string[];
        drag: string;
        walkLeft: string;
        walkRight: string;
    };
}

/** Host plugin body: register the /aqua-pet route + warm the thumb cache. */
export declare function apply(ctx: Context, config?: Config): void;

export type { WebRoute };