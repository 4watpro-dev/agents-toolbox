import { useState } from 'react'
import {
  ACCESSORIES,
  AVATAR_STATES,
  EYE_STYLES,
  GHOST_SHAPES,
  type AvatarConfig,
  type AvatarState
} from '../../../shared/avatar'
import { Avatar } from '../../avatar/Avatar'
import { ACCESSORY_LABELS, EYE_LABELS, SHAPE_LABELS } from '../../avatar/labels'
import { Options, type StepProps } from './fields'

const BODY_SWATCHES = ['#5be370', '#c8f031', '#6fb4ff', '#a98bff', '#ff85b8', '#ff9f57']
const GLOW_SWATCHES = ['#ffffff', '#f1ffc9', '#d6f0ff', '#eadfff', '#ffe0ec', '#fff0c2']

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
        label="Couleur du fantôme"
        swatches={BODY_SWATCHES}
        value={draft.avatar.bodyColor}
        onChange={(bodyColor) => set({ bodyColor })}
      />
      <ColorRow
        label="Couleur de la lueur"
        swatches={GLOW_SWATCHES}
        value={draft.avatar.glowColor}
        onChange={(glowColor) => set({ glowColor })}
      />
      <Options
        label="Forme"
        options={GHOST_SHAPES}
        labels={SHAPE_LABELS}
        value={draft.avatar.shape}
        onChange={(shape) => set({ shape })}
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
