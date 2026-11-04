import { useState } from 'react'
import {
  ACCESSORIES,
  AVATAR_STATES,
  EYE_STYLES,
  HEAD_SHAPES,
  type AvatarConfig,
  type AvatarState
} from '../../../shared/avatar'
import { Avatar } from '../../avatar/Avatar'
import { ACCESSORY_LABELS, EYE_LABELS, HEAD_LABELS } from '../../avatar/labels'
import { Options, type StepProps } from './fields'

const HEAD_SWATCHES = ['#ffffff', '#f4ead7', '#dff3e8', '#dbe7ff', '#ffe0e6', '#2b2f38']
const ANTENNA_SWATCHES = ['#3b8cff', '#2e9e6b', '#e4572e', '#b5533c', '#8e5cf6', '#f2b705']

const STATE_LABELS: Record<AvatarState, string> = {
  idle: 'Repos',
  listening: 'Écoute',
  thinking: 'Réflexion',
  happy: 'Content',
  surprised: 'Surpris',
  confused: 'Confus',
  sorry: 'Désolé'
}

interface ColorRowProps {
  label: string
  swatches: string[]
  value: string
  onChange(color: string): void
}

function ColorRow({ label, swatches, value, onChange }: ColorRowProps): React.JSX.Element {
  return (
    <fieldset className="options">
      <legend className="field-label">{label}</legend>
      <div className="swatches">
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color }}
            aria-label={`Couleur ${color}`}
            aria-pressed={color === value}
            onClick={() => onChange(color)}
          />
        ))}
        <input
          type="color"
          className="swatch-custom"
          aria-label={`${label} : couleur personnalisée`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </fieldset>
  )
}

export function StepAppearance({ draft, update }: StepProps): React.JSX.Element {
  const [state, setState] = useState<AvatarState>('idle')
  const set = (patch: Partial<AvatarConfig>): void => update({ avatar: { ...draft.avatar, ...patch } })

  return (
    <>
      <div className="avatar-preview">
        <Avatar config={draft.avatar} state={state} size={120} label="Aperçu de l'avatar" />
        <select
          className="input input-small"
          aria-label="Essayer une expression"
          value={state}
          onChange={(event) => setState(event.target.value as AvatarState)}
        >
          {AVATAR_STATES.map((name) => (
            <option key={name} value={name}>
              {STATE_LABELS[name]}
            </option>
          ))}
        </select>
      </div>
      <ColorRow
        label="Couleur de la tête"
        swatches={HEAD_SWATCHES}
        value={draft.avatar.headColor}
        onChange={(headColor) => set({ headColor })}
      />
      <ColorRow
        label="Couleur de l'antenne"
        swatches={ANTENNA_SWATCHES}
        value={draft.avatar.antennaColor}
        onChange={(antennaColor) => set({ antennaColor })}
      />
      <Options
        label="Forme de la tête"
        options={HEAD_SHAPES}
        labels={HEAD_LABELS}
        value={draft.avatar.headShape}
        onChange={(headShape) => set({ headShape })}
      />
      <Options
        label="Yeux"
        options={EYE_STYLES}
        labels={EYE_LABELS}
        value={draft.avatar.eyeStyle}
        onChange={(eyeStyle) => set({ eyeStyle })}
      />
      <Options
        label="Accessoire"
        options={ACCESSORIES}
        labels={ACCESSORY_LABELS}
        value={draft.avatar.accessory}
        onChange={(accessory) => set({ accessory })}
      />
    </>
  )
}
