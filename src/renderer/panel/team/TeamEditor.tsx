import { useState } from 'react'
import type { Agent } from '../../../shared/agent'
import { MAX_MEMBERS } from '../../../shared/team'
import type { Team, TeamInput } from '../../../shared/teams'
import { Avatar } from '../../avatar/Avatar'

interface TeamEditorProps {
  team: Team | null
  agents: Agent[]
  onCancel(): void
  onSaved(team: Team): void
  onDeleted(): void
}

/** Création ou modification d'une équipe : nom, chef d'orchestre et membres. */
export function TeamEditor({ team, agents, onCancel, onSaved, onDeleted }: TeamEditorProps): React.JSX.Element {
  const agentIds = agents.map((agent) => agent.id)
  const [input, setInput] = useState<TeamInput>(() => ({
    name: team?.name ?? '',
    chiefId: team?.chiefId && agentIds.includes(team.chiefId) ? team.chiefId : null,
    memberIds: (team?.memberIds ?? []).filter((id) => agentIds.includes(id))
  }))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const members = input.memberIds.filter((id) => id !== input.chiefId)
  const valid = input.name.trim() !== '' && input.chiefId !== null && members.length > 0

  function toggleMember(id: string): void {
    setInput((current) => {
      const has = current.memberIds.includes(id)
      if (!has && current.memberIds.filter((member) => member !== current.chiefId).length >= MAX_MEMBERS) return current
      return { ...current, memberIds: has ? current.memberIds.filter((member) => member !== id) : [...current.memberIds, id] }
    })
  }

  async function save(): Promise<void> {
    const result = await window.toolbox.team.save(team?.id ?? null, { ...input, memberIds: members })
    if (result.ok) onSaved(result.value)
    else setError(result.message)
  }

  async function remove(): Promise<void> {
    if (!team) return
    await window.toolbox.team.remove(team.id)
    onDeleted()
  }

  return (
    <div className="view">
      <header className="view-header">
        <button type="button" className="button-back" onClick={onCancel} aria-label="Annuler">
          ‹
        </button>
        <h1>{team ? `Modifier ${team.name}` : 'Nouvelle équipe'}</h1>
      </header>
      <form
        className="view-body wizard-body"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <label className="field">
          <span className="field-label">Nom de l'équipe</span>
          <input
            className="input"
            maxLength={60}
            placeholder="Équipe com"
            value={input.name}
            onChange={(event) => setInput({ ...input, name: event.target.value })}
            autoFocus
          />
        </label>

        <div className="field">
          <span className="field-label">Chef d'orchestre</span>
          <span className="field-hint">Il répartit le travail puis rédige la réponse finale.</span>
          <div className="chips chips-wrap" role="radiogroup" aria-label="Chef d'orchestre">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                role="radio"
                className="team-chip"
                aria-checked={agent.id === input.chiefId}
                onClick={() => setInput({ ...input, chiefId: agent.id, memberIds: input.memberIds.filter((id) => id !== agent.id) })}
              >
                <Avatar config={agent.avatar} size={20} groundShadow={false} floating={false} />
                {agent.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">
            Membres ({members.length}/{MAX_MEMBERS})
          </span>
          <div className="chips chips-wrap" role="group" aria-label="Membres">
            {agents
              .filter((agent) => agent.id !== input.chiefId)
              .map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="team-chip"
                  aria-pressed={members.includes(agent.id)}
                  onClick={() => toggleMember(agent.id)}
                >
                  <Avatar config={agent.avatar} size={20} groundShadow={false} floating={false} />
                  {agent.name}
                </button>
              ))}
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="task-actions">
          {team &&
            (confirmingDelete ? (
              <div className="settings-confirm" role="alertdialog" aria-label="Supprimer cette équipe ?">
                <span>Supprimer l'équipe, son historique et ses tâches ?</span>
                <button type="button" className="button" onClick={() => setConfirmingDelete(false)}>
                  Annuler
                </button>
                <button type="button" className="button button-danger" onClick={() => void remove()}>
                  Supprimer
                </button>
              </div>
            ) : (
              <button type="button" className="button button-danger" onClick={() => setConfirmingDelete(true)}>
                Supprimer l'équipe
              </button>
            ))}
          <button type="submit" className="button button-primary" disabled={!valid}>
            {team ? 'Enregistrer' : "Créer l'équipe"}
          </button>
        </div>
      </form>
    </div>
  )
}
