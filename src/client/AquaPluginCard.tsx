/**
 * Aqua card registered into the Plugins settings section's configurable tab
 * (`settings.plugin.item`): the master on/off switch in the head, plus a
 * collapse area (the same expand/collapse language as the other plugin
 * cards) holding every glass knob — mode, whale/critters, blur/frost, fluid
 * hue, brightness, backdrop source, and the wallpaper picker with crop and
 * fit controls. The knobs come from the embedded AquaAppearanceRow block;
 * collapsing hides them without unmounting their state.
 */
import { useState } from 'react'
import { IconCheckOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.plugin.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { AquaAppearanceRow, type AquaAppearanceRowInjected } from './AquaAppearanceRow.tsx'
import type { createAquaRowStore } from './settings-store.ts'
import css from './AquaPluginCard.module.css'

/** Injected business face: the master enable write plus every knob write. */
export interface AquaPluginCardInjected extends AquaAppearanceRowInjected {
  /** Switch the glass layer on or off. */
  setEnabled: (enabled: boolean) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AquaPluginCardComponentProps =
  PropsRuntime<'settings.plugin.item'> & PropsStore<ReturnType<typeof createAquaRowStore>>
  & PropsLocale<'settings.aqua'> & InjectFace<AquaPluginCardInjected>

/**
 * Render the Aqua plugin card.
 * @param props - composed slot props.
 * @returns the card list item.
 */
export function AquaPluginCard(props: AquaPluginCardComponentProps) {
  const { t, setEnabled, useStore } = props
  const enabled = useStore(s => s.enabled)
  const [expanded, setExpanded] = useState(false)

  return (
    <li className={css.card}>
      <div className={css.head}>
        <div className={css.text}>
          <div className={css.title}>{t('aqua.title')}</div>
          <div className={css.description}>{t('aqua.description')}</div>
        </div>
        <div className={css.actions}>
          <button
            type="button"
            className={css.expand}
            aria-expanded={expanded}
            disabled={!enabled}
            title={enabled ? undefined : t('aqua.disabledHint')}
            onClick={() => { setExpanded(!expanded) }}
          >
            <span className={expanded ? css.chevronOpen : css.chevron}>▸</span>
            {expanded ? t('aqua.collapse') : t('aqua.expand')}
          </button>
          <button
            type="button"
            className={css.toggle}
            aria-pressed={enabled}
            onClick={() => {
              setEnabled(!enabled)
              if (!enabled) setExpanded(false)
            }}
          >
            <span className={css.check}>
              {enabled && <IconCheckOutline16 />}
            </span>
            {enabled ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>
      </div>
      {expanded && enabled && <AquaAppearanceRow {...props} embedded />}
    </li>
  )
}
