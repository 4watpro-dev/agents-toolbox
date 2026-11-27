import { useEffect, useState } from 'react'
import { EFFORTS, MODELS, type AgentDraft } from '../../../shared/agent'
import type { Connector } from '../../../shared/connectors'
import { composePrompt } from '../../../shared/systemPrompt'
import { parseDomains, usesWebTools } from '../../../shared/tools'
import { ConnectorForm } from '../ConnectorForm'
import { FolderIcon } from '../icons'
import { Field, Options, type StepProps } from './fields'

const EFFORT_IDS = EFFORTS.map((effort) => effort.id)
const EFFORT_LABELS = Object.fromEntries(EFFORTS.map((effort) => [effort.id, effort.label])) as Record<AgentDraft['effort'], string>

export function StepSkills({ draft, update }: StepProps): React.JSX.Element {
  const [advanced, setAdvanced] = useState(draft.systemPromptOverride !== undefined)
  const composed = composePrompt(draft)
  const { tools } = draft
  const [domainsText, setDomainsText] = useState(tools.allowedDomains.join('\n'))
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [folderError, setFolderError] = useState<string | null>(null)

  async function chooseFolder(): Promise<void> {
    setFolderError(null)
    const result = await window.toolbox.chooseKnowledgeFolder()
    if (!result.ok) setFolderError(result.message)
    else if (result.value) update({ tools: { ...tools, knowledgeFolder: result.value.path } })
  }

  useEffect(() => {
    void window.toolbox.connectors.list().then(setConnectors)
  }, [])

  /** Connexion OAuth lancée d'ici même : le navigateur s'ouvre, puis la liste se met à jour. */
  const [signingIn, setSigningIn] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<{ id: string; message: string } | null>(null)
  const [addingConnector, setAddingConnector] = useState(false)

  async function login(id: string): Promise<void> {
    setSigningIn(id)
    setLoginError(null)
    const result = await window.toolbox.connectors.login(id)
    setSigningIn(null)
    if (!result.ok) setLoginError({ id, message: result.message })
    setConnectors(await window.toolbox.connectors.list())
  }

  async function logout(id: string): Promise<void> {
    await window.toolbox.connectors.logout(id)
    setConnectors(await window.toolbox.connectors.list())
  }

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
              hint="Un par ligne, sous-domaines compris. Ces sites s'ouvrent sans te demander. Pour tout autre site, tu vois l'adresse complète et tu confirmes ; dans une tâche planifiée ou une équipe, il est refusé."
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
              Avec ton abonnement, c'est compris dans ton forfait. Avec une clé API, chaque recherche coûte 10 $ les 1 000, plus les jetons
              des pages lues.
            </p>
          </>
        )}
        <span className="field-label tools-group">Dossier de documents</span>
        {tools.knowledgeFolder ? (
          <div className="knowledge-folder">
            <FolderIcon size={18} />
            <span className="knowledge-path" title={tools.knowledgeFolder}>
              {tools.knowledgeFolder.replace(/^\/Users\/[^/]+/, '~')}
            </span>
            <button type="button" className="button" onClick={() => void chooseFolder()}>
              Changer
            </button>
            <button type="button" className="button" onClick={() => update({ tools: { ...tools, knowledgeFolder: null } })}>
              Retirer
            </button>
          </div>
        ) : (
          <button type="button" className="button knowledge-choose" onClick={() => void chooseFolder()}>
            Choisir un dossier…
          </button>
        )}
        {folderError && (
          <p className="form-error" role="alert">
            {folderError}
          </p>
        )}
        <p className="field-hint">
          L'agent cherche et lit les fichiers utiles de ce dossier (texte, PDF, images), sans jamais rien y modifier ni lire ailleurs. Avec
          ton abonnement uniquement. Le chemin n'est pas inclus quand tu exportes l'agent.
        </p>
        <span className="field-label tools-group">Connecteurs MCP</span>
        {connectors.length === 0 ? (
          <p className="field-hint">Aucun connecteur pour l'instant.</p>
        ) : (
          <>
            {connectors.map((connector) => (
              <div key={connector.id} className="connector-option">
                <label className="tool-option">
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
                {connector.auth === 'token' && connector.hasToken && (
                  <>
                    <span className="connector-status is-on">Jeton enregistré</span>
                    <button type="button" className="button button-small" disabled={signingIn !== null} onClick={() => void logout(connector.id)}>
                      Se déconnecter
                    </button>
                  </>
                )}
                {connector.auth === 'oauth' &&
                  (connector.connected ? (
                    <>
                      <span className="connector-status is-on">Connecté</span>
                      <button type="button" className="button button-small" disabled={signingIn !== null} onClick={() => void logout(connector.id)}>
                        Se déconnecter
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="connector-status">
                        {signingIn === connector.id ? 'Termine la connexion dans ton navigateur…' : 'Connexion requise'}
                      </span>
                      <button
                        type="button"
                        className={tools.connectors.includes(connector.id) ? 'button button-primary button-small' : 'button button-small'}
                        disabled={signingIn !== null}
                        onClick={() => void login(connector.id)}
                      >
                        {signingIn === connector.id ? 'Connexion…' : 'Se connecter'}
                      </button>
                    </>
                  ))}
                {loginError?.id === connector.id && (
                  <p className="form-error connector-option-error" role="alert">
                    {loginError.message}
                  </p>
                )}
              </div>
            ))}
            <p className="field-hint">Les lectures passent directement. Toute autre action demande ton clic dans le chat.</p>
          </>
        )}
        {addingConnector ? (
          <ConnectorForm
            editing={null}
            onCancel={() => setAddingConnector(false)}
            onSaved={(connector) => {
              setAddingConnector(false)
              // Ajouté depuis cette fiche : il est aussitôt activé pour cet agent.
              update({ tools: { ...tools, connectors: [...tools.connectors, connector.id] } })
              void window.toolbox.connectors.list().then(setConnectors)
            }}
          />
        ) : (
          <button type="button" className="button connector-add" onClick={() => setAddingConnector(true)}>
            + Ajouter un connecteur
          </button>
        )}
      </fieldset>

      <details className="advanced" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
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
