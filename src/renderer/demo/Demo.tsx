import { useState } from 'react'
import {
  ACCESSORIES,
  AVATAR_STATES,
  DEFAULT_AVATAR,
  EYE_STYLES,
  HEAD_SHAPES,
  type AvatarConfig,
  type AvatarState
} from '../../shared/avatar'
import { Avatar } from '../avatar/Avatar'
import { ACCESSORY_LABELS, EYE_LABELS, HEAD_LABELS } from '../avatar/labels'

const STATE_LABELS: Record<AvatarState, string> = {
  idle: 'Repos',
  listening: 'Écoute',
  thinking: 'Réflexion',
  happy: 'Content',
  surprised: 'Surpris',
  confused: 'Confus',
  sorry: 'Désolé'
}

interface ChoiceProps<T extends string> {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  value: T
  onChange: (value: T) => void
}

function Choice<T extends string>({ label, options, labels, value, onChange }: ChoiceProps<T>): React.JSX.Element {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </fieldset>
  )
}

export function Demo(): React.JSX.Element {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR)
  const [state, setState] = useState<AvatarState>('idle')
  const update = (patch: Partial<AvatarConfig>): void => setConfig((current) => ({ ...current, ...patch }))

  return (
    <main className="demo">
      <h1>Démo de l'avatar</h1>

      <section className="workbench">
        <div className="stage">
          <Avatar config={config} state={state} size={220} label={`Avatar, état ${STATE_LABELS[state]}`} />
          <div className="small-sizes">
            <Avatar config={config} state={state} size={72} groundShadow={false} />
            <Avatar config={config} state={state} size={46} groundShadow={false} />
          </div>
        </div>

        <div className="controls">
          <Choice label="État" options={AVATAR_STATES} labels={STATE_LABELS} value={state} onChange={setState} />
          <Choice
            label="Forme de la tête"
            options={HEAD_SHAPES}
            labels={HEAD_LABELS}
            value={config.headShape}
            onChange={(headShape) => update({ headShape })}
          />
          <Choice
            label="Yeux"
            options={EYE_STYLES}
            labels={EYE_LABELS}
            value={config.eyeStyle}
            onChange={(eyeStyle) => update({ eyeStyle })}
          />
          <Choice
            label="Accessoire"
            options={ACCESSORIES}
            labels={ACCESSORY_LABELS}
            value={config.accessory}
            onChange={(accessory) => update({ accessory })}
          />
          <div className="colors">
            <label>
              Tête
              <input
                type="color"
                value={config.headColor}
                onChange={(event) => update({ headColor: event.target.value })}
              />
            </label>
            <label>
              Antenne
              <input
                type="color"
                value={config.antennaColor}
                onChange={(event) => update({ antennaColor: event.target.value })}
              />
            </label>
          </div>
        </div>
      </section>

      <h2>Tous les états</h2>
      <section className="grid">
        {AVATAR_STATES.map((name) => (
          <figure key={name}>
            <Avatar config={config} state={name} size={110} />
            <figcaption>{STATE_LABELS[name]}</figcaption>
          </figure>
        ))}
      </section>

      <h2>Tous les accessoires</h2>
      <section className="grid">
        {ACCESSORIES.map((accessory) => (
          <figure key={accessory}>
            <Avatar config={{ ...config, accessory }} size={110} />
            <figcaption>{ACCESSORY_LABELS[accessory]}</figcaption>
          </figure>
        ))}
      </section>
    </main>
  )
}
