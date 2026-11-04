import { useCallback, useMemo, useState } from 'react'
import type { Agent } from '../../shared/agent'
import { filterAgents } from '../../shared/gallery'
import { Avatar } from '../avatar/Avatar'
import { useEscape } from './useEscape'

interface AgentSwitcherProps {
  agent: Agent
  agents: Agent[]
  onSwitch(agent: Agent): void
}

/** Titre de la conversation, qui ouvre la liste des agents pour changer sans quitter le chat. */
export function AgentSwitcher({ agent, agents, onSwitch }: AgentSwitcherProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const others = useMemo(
    () => filterAgents(agents, { query: '', category: null }).filter((other) => other.id !== agent.id),
    [agents, agent.id]
  )

  const close = useCallback(() => setOpen(false), [])
  useEscape(open, close)

  return (
    <div className="switcher">
      <button
        type="button"
        className="switcher-button"
        aria-label={`Changer d'agent. Agent actuel : ${agent.name}`}
        aria-expanded={open}
        disabled={others.length === 0}
        onClick={() => setOpen(!open)}
      >
        <span className="switcher-name">
          {agent.name}
          {others.length > 0 && <span aria-hidden="true"> ▾</span>}
        </span>
        <span className="switcher-specialty">{agent.specialty}</span>
      </button>
      {open && (
        <>
          <div className="switcher-backdrop" onClick={() => setOpen(false)} />
          <ul className="switcher-list" role="menu">
            {others.map((other) => (
              <li key={other.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onSwitch(other)
                  }}
                >
                  <Avatar config={other.avatar} size={30} groundShadow={false} floating={false} />
                  <span>
                    <span className="switcher-name">{other.name}</span>
                    <span className="switcher-specialty">{other.specialty}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
