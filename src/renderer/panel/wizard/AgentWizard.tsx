import { useState } from 'react'
import { EMPTY_DRAFT, toDraft, type Agent, type AgentDraft } from '../../../shared/agent'
import { ChatView } from '../chat/ChatView'
import { resetChatSession } from '../chat/chatStore'
import { GenerateBox } from './GenerateBox'
import { StepAppearance } from './StepAppearance'
import { StepIdentity } from './StepIdentity'
import { StepPersonality } from './StepPersonality'
import { StepSkills } from './StepSkills'
import { finalizeDraft, firstInvalidStep, stepError, STEPS } from './validation'

const TEST_SESSION = 'wizard-test'

interface AgentWizardProps {
  agent: Agent | null
  panelOpen: boolean
  onCancel(): void
  onOpenSettings(): void
  onSave(draft: AgentDraft): Promise<void>
}

export function AgentWizard({ agent, panelOpen, onCancel, onOpenSettings, onSave }: AgentWizardProps): React.JSX.Element {
  const [draft, setDraft] = useState<AgentDraft>(agent ? toDraft(agent) : EMPTY_DRAFT)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const isLast = step === STEPS.length - 1

  function startTest(): void {
    const invalid = firstInvalidStep(draft)
    if (invalid !== null) {
      setStep(invalid)
      setError(stepError(invalid, draft))
      return
    }
    setError(null)
    setTesting(true)
  }

  function endTest(): void {
    // Un essai ne laisse aucune trace : il n'est ni conservé ni repris au test suivant.
    resetChatSession(TEST_SESSION)
    setTesting(false)
  }

  if (testing) {
    return (
      <ChatView
        sessionId={TEST_SESSION}
        agent={finalizeDraft(draft)}
        panelOpen={panelOpen}
        subtitle="Essai : rien n'est conservé"
        backLabel="Revenir à la fiche de l'agent"
        onBack={endTest}
        onOpenSettings={onOpenSettings}
      />
    )
  }

  function update(patch: Partial<AgentDraft>): void {
    setDraft((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function goTo(target: number): void {
    // On peut revenir en arrière librement ; avancer exige des étapes complètes.
    if (target > step) {
      for (let index = step; index < target; index++) {
        const message = stepError(index, draft)
        if (message) {
          setStep(index)
          setError(message)
          return
        }
      }
    }
    setError(null)
    setStep(target)
  }

  async function save(): Promise<void> {
    const invalid = firstInvalidStep(draft)
    if (invalid !== null) {
      setStep(invalid)
      setError(stepError(invalid, draft))
      return
    }
    setSaving(true)
    try {
      await onSave(finalizeDraft(draft))
    } catch {
      setError("L'enregistrement a échoué. Vérifie les champs, puis réessaie.")
      setSaving(false)
    }
  }

  return (
    <form
      className="view"
      onSubmit={(event) => {
        event.preventDefault()
        if (isLast) void save()
        else goTo(step + 1)
      }}
    >
      <header className="view-header">
        <button type="button" className="button-back" onClick={onCancel} aria-label="Annuler et revenir à la galerie">
          ‹
        </button>
        <h1>{agent ? `Modifier ${agent.name}` : 'Nouvel agent'}</h1>
      </header>

      <ol className="steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className="step"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => goTo(index)}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="view-body wizard-body">
        {step === 0 && (
          <GenerateBox
            draft={draft}
            onGenerated={(generated) => {
              setDraft(generated)
              setError(null)
            }}
          />
        )}
        {step === 0 && <StepIdentity draft={draft} update={update} />}
        {step === 1 && <StepAppearance draft={draft} update={update} />}
        {step === 2 && <StepPersonality draft={draft} update={update} />}
        {step === 3 && <StepSkills draft={draft} update={update} />}
      </div>

      <footer className="view-footer">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="footer-actions">
          <button type="button" className="button" disabled={step === 0} onClick={() => goTo(step - 1)}>
            Précédent
          </button>
          <button type="button" className="button" onClick={startTest}>
            Tester
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {isLast ? (saving ? 'Enregistrement…' : 'Enregistrer') : 'Suivant'}
          </button>
        </div>
      </footer>
    </form>
  )
}
