import type { ReactNode } from 'react'
import type { AgentDraft } from '../../../shared/agent'

export interface StepProps {
  draft: AgentDraft
  update(patch: Partial<AgentDraft>): void
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

interface OptionsProps<T extends string> {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  value: T
  onChange(value: T): void
}

export function Options<T extends string>({ label, options, labels, value, onChange }: OptionsProps<T>): React.JSX.Element {
  return (
    <fieldset className="options">
      <legend className="field-label">{label}</legend>
      <div className="chips chips-wrap">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Interrupteur : une case à cocher stylée, lue comme « switch » par VoiceOver. */
export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange(checked: boolean): void }): React.JSX.Element {
  return (
    <input
      type="checkbox"
      role="switch"
      className="switch"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

/** Bloc d'une étape : un titre, une phrase d'explication, puis son contenu. */
export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <section className="skill-card">
      <header className="skill-card-head">
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}
