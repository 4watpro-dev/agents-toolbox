import { useState } from 'react'
import { EFFORTS, MODELS, type AgentDraft } from '../../../shared/agent'
import { composePrompt } from '../../../shared/systemPrompt'
import { Field, Options, type StepProps } from './fields'

const EFFORT_IDS = EFFORTS.map((effort) => effort.id)
const EFFORT_LABELS = Object.fromEntries(EFFORTS.map((effort) => [effort.id, effort.label])) as Record<
  AgentDraft['effort'],
  string
>

export function StepSkills({ draft, update }: StepProps): React.JSX.Element {
  const [advanced, setAdvanced] = useState(draft.systemPromptOverride !== undefined)
  const composed = composePrompt(draft)

  return (
    <>
      <Field label="Instructions métier" hint="Ce que l'agent doit savoir faire, et comment.">
        <textarea
          className="input"
          rows={5}
          maxLength={8000}
          value={draft.instructions}
          onChange={(event) => update({ instructions: event.target.value })}
        />
      </Field>

      <Field label="Modèle">
        <select className="input" value={draft.model} onChange={(event) => update({ model: event.target.value })}>
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} : {model.hint}
            </option>
          ))}
        </select>
      </Field>

      <Options
        label="Profondeur de réflexion"
        options={EFFORT_IDS}
        labels={EFFORT_LABELS}
        value={draft.effort}
        onChange={(effort) => update({ effort })}
      />
      <p className="field-hint">Plus de réflexion donne des réponses plus solides, mais plus lentes et plus chères.</p>

      <Field label="Message d'accueil">
        <textarea
          className="input"
          rows={2}
          maxLength={400}
          value={draft.greeting}
          onChange={(event) => update({ greeting: event.target.value })}
        />
      </Field>

      <details
        className="advanced"
        open={advanced}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
      >
        <summary>Mode avancé : prompt système</summary>
        <textarea
          className="input input-code"
          rows={10}
          maxLength={12000}
          aria-label="Prompt système"
          value={draft.systemPromptOverride ?? composed}
          onChange={(event) => update({ systemPromptOverride: event.target.value })}
        />
        {draft.systemPromptOverride !== undefined ? (
          <div className="advanced-note">
            <span className="field-hint">Prompt manuel : les autres champs ne le modifient plus.</span>
            <button type="button" className="button" onClick={() => update({ systemPromptOverride: undefined })}>
              Rétablir l'automatique
            </button>
          </div>
        ) : (
          <p className="field-hint">Assemblé à partir de la fiche. Le modifier le rend manuel.</p>
        )}
      </details>
    </>
  )
}
