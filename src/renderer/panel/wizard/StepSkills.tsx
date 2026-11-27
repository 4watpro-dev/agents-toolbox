import { useEffect, useState, type ReactNode } from 'react'
import { EFFORTS, MODELS, type AgentDraft } from '../../../shared/agent'
import type { Connector } from '../../../shared/connectors'
import { composePrompt } from '../../../shared/systemPrompt'
import { parseDomains, usesWebTools } from '../../../shared/tools'
import { ConnectorForm } from '../ConnectorForm'
import { BrowserIcon, FolderIcon, GlobeIcon, PlugIcon } from '../icons'
import { Field, Options, Section, Switch, type StepProps } from './fields'

const EFFORT_IDS = EFFORTS.map((effort) => effort.id)
const EFFORT_LABELS = Object.fromEntries(EFFORTS.map((effort) => [effort.id, effort.label])) as Record<AgentDraft['effort'], string>

/** Une ligne d'outil : icône, nom, description courte, et son réglage à droite. */
function ToolRow({
  icon,
  title,
  description,
  control,
  children
}: {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  control: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  return (
    <div className="skill-row">
      <div className="skill-row-main">
        <span className="skill-row-icon">{icon}</span>
        <span className="skill-row-text">
          <span className="skill-row-title">{title}</span>
          <span className="skill-row-desc">{description}</span>
        </span>
        <span className="skill-row-control">{control}</span>
      </div>
      {children && <div className="skill-row-detail">{children}</div>}
    </div>
  )
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** État d'un connecteur, en une pastille. */
function ConnectorChips({ connector, signingIn }: { connector: Connector; signingIn: boolean }): React.JSX.Element {
  let state: { text: string; tone: 'ok' | 'warn' | 'muted' }
  if (connector.auth === 'oauth') {
    state = signingIn
      ? { text: 'Connexion…', tone: 'muted' }
      : connector.connected
        ? { text: 'Connecté', tone: 'ok' }
        : { text: 'Connexion requise', tone: 'warn' }
  } else {
    state = connector.hasToken ? { text: 'Jeton', tone: 'ok' } : { text: 'Sans jeton', tone: 'muted' }
  }
  return (
    <>
      <span className={`status-chip is-${state.tone}`}>{state.text}</span>
      {connector.readOnly && <span className="status-chip is-warn">Lecture seule</span>}
    </>
  )
}

export function StepSkills({ draft, update }: StepProps): React.JSX.Element {
  const [advanced, setAdvanced] = useState(draft.systemPromptOverride !== undefined)
  const composed = composePrompt(draft)
  const { tools } = draft
  const [domainsText, setDomainsText] = useState(tools.allowedDomains.join('\n'))
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [folderError, setFolderError] = useState<string | null>(null)
  /** Connexion OAuth lancée d'ici même : le navigateur s'ouvre, puis la liste se met à jour. */
  const [signingIn, setSigningIn] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<{ id: string; message: string } | null>(null)
  const [addingConnector, setAddingConnector] = useState(false)

  useEffect(() => {
    void window.toolbox.connectors.list().then(setConnectors)
  }, [])

  const setTools = (patch: Partial<AgentDraft['tools']>): void => update({ tools: { ...tools, ...patch } })

  async function chooseFolder(): Promise<void> {
    setFolderError(null)
    const result = await window.toolbox.chooseKnowledgeFolder()
    if (!result.ok) setFolderError(result.message)
    else if (result.value) setTools({ knowledgeFolder: result.value.path })
  }

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

  const toggleConnector = (id: string, on: boolean): void =>
    setTools({ connectors: on ? [...tools.connectors, id] : tools.connectors.filter((other) => other !== id) })

  return (
    <>
      <Section title="Rôle" hint="Ce que l'agent sait faire, et comment il t'accueille.">
        <Field label="Instructions métier">
          <textarea
            className="input"
            rows={5}
            maxLength={8000}
            placeholder="Ex. : tu relis mes textes, tu corriges l'orthographe et tu proposes des tournures plus vivantes."
            value={draft.instructions}
            onChange={(event) => update({ instructions: event.target.value })}
          />
        </Field>
        <Field label="Message d'accueil">
          <textarea
            className="input"
            rows={2}
            maxLength={400}
            placeholder="Ex. : Salut ! Envoie-moi ton texte."
            value={draft.greeting}
            onChange={(event) => update({ greeting: event.target.value })}
          />
        </Field>
      </Section>

      <Section title="Moteur" hint="Plus de réflexion : des réponses plus solides, mais plus lentes et plus coûteuses.">
        <Field label="Modèle">
          <select className="input" value={draft.model} onChange={(event) => update({ model: event.target.value })}>
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} : {model.hint}
              </option>
            ))}
          </select>
        </Field>
        <Options label="Profondeur de réflexion" options={EFFORT_IDS} labels={EFFORT_LABELS} value={draft.effort} onChange={(effort) => update({ effort })} />
      </Section>

      <Section title="Outils" hint="Aucun n'est actif par défaut : active seulement ce dont l'agent a besoin.">
        <ToolRow
          icon={<GlobeIcon size={17} />}
          title="Recherche web"
          description="Trouver des informations récentes."
          control={<Switch label="Recherche web" checked={tools.webSearch} onChange={(webSearch) => setTools({ webSearch })} />}
        />
        <ToolRow
          icon={<BrowserIcon size={17} />}
          title="Lecture de pages"
          description="Ouvrir et lire une page précise."
          control={<Switch label="Lecture de pages" checked={tools.webFetch} onChange={(webFetch) => setTools({ webFetch })} />}
        />
        {usesWebTools(tools) && (
          <div className="skill-subpanel">
            <Field label="Sites autorisés (optionnel)" hint="Un par ligne. Ils s'ouvrent sans te demander ; les autres pages te sont soumises.">
              <textarea
                className="input"
                rows={2}
                spellCheck={false}
                placeholder="brevo.com"
                value={domainsText}
                onChange={(event) => {
                  setDomainsText(event.target.value)
                  setTools({ allowedDomains: parseDomains(event.target.value) })
                }}
              />
            </Field>
            <details className="skill-more">
              <summary>En savoir plus</summary>
              <p>Les sous-domaines sont compris. Dans une tâche planifiée ou une équipe, une page hors de la liste est refusée, faute de quelqu'un pour confirmer.</p>
              <p>Avec ton abonnement, c'est compris dans ton forfait. Avec une clé API, chaque recherche coûte 10 $ les 1 000, plus les jetons des pages lues.</p>
            </details>
          </div>
        )}
        <ToolRow
          icon={<FolderIcon size={17} />}
          title="Dossier de documents"
          description={
            tools.knowledgeFolder ? (
              <span className="knowledge-path" title={tools.knowledgeFolder}>
                {tools.knowledgeFolder.replace(/^\/Users\/[^/]+/, '~')}
              </span>
            ) : (
              'Lire tes fichiers (texte, PDF, images), sans rien y modifier.'
            )
          }
          control={
            tools.knowledgeFolder ? (
              <span className="skill-row-buttons">
                <button type="button" className="button button-small" onClick={() => void chooseFolder()}>
                  Changer
                </button>
                <button type="button" className="button button-small" onClick={() => setTools({ knowledgeFolder: null })}>
                  Retirer
                </button>
              </span>
            ) : (
              <button type="button" className="button button-small" onClick={() => void chooseFolder()}>
                Choisir…
              </button>
            )
          }
        >
          {folderError && (
            <p className="form-error" role="alert">
              {folderError}
            </p>
          )}
        </ToolRow>
      </Section>

      <Section
        title="Connecteurs"
        hint="Les lectures passent seules ; toute autre action demande ton clic dans le chat."
        action={
          !addingConnector && (
            <button type="button" className="button button-small" onClick={() => setAddingConnector(true)}>
              + Ajouter
            </button>
          )
        }
      >
        {addingConnector && (
          <div className="skill-subpanel">
            <ConnectorForm
              editing={null}
              onCancel={() => setAddingConnector(false)}
              onSaved={(connector) => {
                setAddingConnector(false)
                // Ajouté depuis cette fiche : il est aussitôt activé pour cet agent.
                setTools({ connectors: [...tools.connectors, connector.id] })
                void window.toolbox.connectors.list().then(setConnectors)
              }}
            />
          </div>
        )}
        {connectors.length === 0 && !addingConnector && <p className="skill-empty">Aucun connecteur pour l'instant.</p>}
        {connectors.map((connector) => {
          const enabled = tools.connectors.includes(connector.id)
          const canLogout = connector.auth === 'oauth' ? connector.connected : connector.hasToken
          return (
            <ToolRow
              key={connector.id}
              icon={<PlugIcon size={17} />}
              title={
                <>
                  {connector.name}
                  <ConnectorChips connector={connector} signingIn={signingIn === connector.id} />
                </>
              }
              description={
                <>
                  {hostOf(connector.url)}
                  {connector.auth === 'oauth' && !connector.connected && (
                    <button type="button" className="link-button is-accent" disabled={signingIn !== null} onClick={() => void login(connector.id)}>
                      {signingIn === connector.id ? 'Termine dans ton navigateur…' : 'Se connecter'}
                    </button>
                  )}
                  {canLogout && (
                    <button type="button" className="link-button" disabled={signingIn !== null} onClick={() => void logout(connector.id)}>
                      Se déconnecter
                    </button>
                  )}
                </>
              }
              control={<Switch label={`Activer ${connector.name} pour cet agent`} checked={enabled} onChange={(on) => toggleConnector(connector.id, on)} />}
            >
              {loginError?.id === connector.id && (
                <p className="form-error" role="alert">
                  {loginError.message}
                </p>
              )}
            </ToolRow>
          )
        })}
      </Section>

      <details className="advanced skill-card" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
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
