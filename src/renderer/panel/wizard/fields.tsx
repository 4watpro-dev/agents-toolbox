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
