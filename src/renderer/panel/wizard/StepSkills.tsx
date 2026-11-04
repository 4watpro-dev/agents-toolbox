import { useEffect, useState } from 'react'
import { EFFORTS, MODELS, type AgentDraft } from '../../../shared/agent'
import type { Connector } from '../../../shared/connectors'
import { composePrompt } from '../../../shared/systemPrompt'
import { parseDomains, usesWebTools } from '../../../shared/tools'
import { Field, Options, type StepProps } from './fields'

const EFFORT_IDS = EFFORTS.map((effort) => effort.id)
const EFFORT_LABELS = Object.fromEntries(EFFORTS.map((effort) => [effort.id, effort.label])) as Record<
  AgentDraft['effort'],
  string
>

export function StepSkills({ draft, update }: StepProps): React.JSX.Element {
  const [advanced, setAdvanced] = useState(draft.systemPromptOverride !== undefined)
  const composed = composePrompt(draft)
  const { tools } = draft
  const [domainsText, setDomainsText] = useState(tools.allowedDomains.join('\n'))
  const [connectors, setConnectors] = useState<Connector[]>([])

  useEffect(() => {
    void window.toolbox.connectors.list().then(setConnectors)
  }, [])

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

      <fieldset className="options tools">
        <legend className="field-label">Outils</legend>
        <label className="tool-option">
          <input
            type="checkbox"
            checked={tools.webSearch}
            onChange={(event) => update({ tools: { ...tools, webSearch: event.target.checked } })}
          />
          Recherche web
        </label>
        <label className="tool-option">
          <input
            type="checkbox"
            checked={tools.webFetch}
            onChange={(event) => update({ tools: { ...tools, webFetch: event.target.checked } })}
          />
          Lecture de pages web
        </label>
        {usesWebTools(tools) && (
          <>
            <Field
              label="Domaines autorisés (optionnel)"
              hint="Un par ligne, sous-domaines compris. Sans liste, l'agent peut accéder à tout le web : une page malveillante pourrait alors tenter de lui faire envoyer ailleurs ce qu'il sait."
            >
              <textarea
                className="input"
                rows={3}
                spellCheck={false}
                placeholder="brevo.com"
                value={domainsText}
                onChange={(event) => {
                  setDomainsText(event.target.value)
                  update({ tools: { ...tools, allowedDomains: parseDomains(event.target.value) } })
                }}
              />
            </Field>
            <p className="field-hint">
              Avec ton abonnement, c'est compris dans ton forfait. Avec une clé API, chaque recherche coûte 10 $ les 1 000, plus les jetons des pages lues.
            </p>
          </>
        )}
        <span className="field-label tools-group">Connecteurs MCP</span>
        {connectors.length === 0 ? (
          <p className="field-hint">Aucun connecteur : ajoutes-en un dans les réglages (⚙), puis reviens ici.</p>
        ) : (
          <>
            {connectors.map((connector) => (
              <label key={connector.id} className="tool-option">
                <input
                  type="checkbox"
                  checked={tools.connectors.includes(connector.id)}
                  onChange={(event) =>
                    update({
                      tools: {
                        ...tools,
                        connectors: event.target.checked
                          ? [...tools.connectors, connector.id]
                          : tools.connectors.filter((id) => id !== connector.id)
                      }
                    })
                  }
                />
                {connector.name}
              </label>
            ))}
            <p className="field-hint">Les lectures passent directement. Toute autre action demande ton clic dans le chat.</p>
          </>
        )}
      </fieldset>

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
