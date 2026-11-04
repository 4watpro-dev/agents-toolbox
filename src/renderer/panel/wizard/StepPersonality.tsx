import { useState, type KeyboardEvent } from 'react'
import { MAX_CATCHPHRASES, SUGGESTED_TRAITS, type AgentDraft } from '../../../shared/agent'
import { Field, Options, type StepProps } from './fields'

type Personality = AgentDraft['personality']
type SliderKey = keyof Personality['sliders']

const SLIDERS: { key: SliderKey; low: string; high: string }[] = [
  { key: 'formality', low: 'Formel', high: 'Décontracté' },
  { key: 'detail', low: 'Concis', high: 'Détaillé' },
  { key: 'humor', low: 'Sérieux', high: 'Humoristique' },
  { key: 'boldness', low: 'Prudent', high: 'Audacieux' }
]

const ADDRESS_LABELS = { tu: 'Tutoiement', vous: 'Vouvoiement' }

export function StepPersonality({ draft, update }: StepProps): React.JSX.Element {
  const { personality } = draft
  const [customTrait, setCustomTrait] = useState('')
  const set = (patch: Partial<Personality>): void => update({ personality: { ...personality, ...patch } })

  function toggleTrait(trait: string): void {
    set({
      traits: personality.traits.includes(trait)
        ? personality.traits.filter((other) => other !== trait)
        : [...personality.traits, trait]
    })
  }

  function addCustomTrait(): void {
    const trait = customTrait.trim()
    if (trait && !personality.traits.includes(trait)) set({ traits: [...personality.traits, trait] })
    setCustomTrait('')
  }

  function onCustomTraitKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      // Entrée ajoute le trait au lieu de passer à l'étape suivante.
      event.preventDefault()
      addCustomTrait()
    }
  }

  function setCatchphrase(index: number, value: string): void {
    const phrases = Array.from({ length: MAX_CATCHPHRASES }, (_, i) => personality.catchphrases[i] ?? '')
    phrases[index] = value
    set({ catchphrases: phrases })
  }

  const traitChoices = [...new Set<string>([...SUGGESTED_TRAITS, ...personality.traits])]

  return (
    <>
      {SLIDERS.map(({ key, low, high }) => (
        <label key={key} className="slider">
          <span className="slider-labels">
            <span>{low}</span>
            <span>{high}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            aria-label={`${low} ou ${high}`}
            value={personality.sliders[key]}
            onChange={(event) =>
              set({ sliders: { ...personality.sliders, [key]: Number(event.target.value) } })
            }
          />
        </label>
      ))}

      <Options
        label="Comment s'adresse-t-il à toi ?"
        options={['tu', 'vous'] as const}
        labels={ADDRESS_LABELS}
        value={personality.tuVous}
        onChange={(tuVous) => set({ tuVous })}
      />

      <fieldset className="options">
        <legend className="field-label">Traits de caractère</legend>
        <div className="chips chips-wrap">
          {traitChoices.map((trait) => (
            <button
              key={trait}
              type="button"
              className="chip"
              aria-pressed={personality.traits.includes(trait)}
              onClick={() => toggleTrait(trait)}
            >
              {trait}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Autre trait, puis Entrée"
          aria-label="Ajouter un autre trait de caractère"
          maxLength={40}
          value={customTrait}
          onChange={(event) => setCustomTrait(event.target.value)}
          onKeyDown={onCustomTraitKey}
          onBlur={addCustomTrait}
        />
      </fieldset>

      <fieldset className="options">
        <legend className="field-label">Expressions fétiches (1 à 3)</legend>
        {Array.from({ length: MAX_CATCHPHRASES }, (_, index) => (
          <input
            key={index}
            className="input"
            maxLength={120}
            aria-label={`Expression fétiche ${index + 1}`}
            placeholder={index === 0 ? 'ex. : Allez, on y va !' : 'Facultatif'}
            value={personality.catchphrases[index] ?? ''}
            onChange={(event) => setCatchphrase(index, event.target.value)}
          />
        ))}
      </fieldset>

      <Field label="Son histoire" hint="Deux ou trois phrases.">
        <textarea
          className="input"
          rows={3}
          maxLength={800}
          value={personality.backstory}
          onChange={(event) => set({ backstory: event.target.value })}
        />
      </Field>
    </>
  )
}
