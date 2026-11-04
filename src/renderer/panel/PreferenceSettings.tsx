import { useCallback, useEffect, useState } from 'react'
import type { ShortcutState } from '../../shared/ipc'
import { DEFAULT_SHORTCUT, formatAccelerator, toAccelerator } from '../../shared/shortcut'

export function PreferenceSettings({ panelOpen }: { panelOpen: boolean }): React.JSX.Element {
  const [shortcut, setShortcut] = useState<ShortcutState | null>(null)
  const [recording, setRecording] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [loginItem, setLoginItem] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void window.toolbox.preferences.getShortcut().then(setShortcut)
    // La coche peut aussi changer depuis le menu de la barre.
    void window.toolbox.preferences.getLoginItem().then(setLoginItem)
  }, [])

  useEffect(() => {
    if (panelOpen) refresh()
  }, [panelOpen, refresh])

  const apply = useCallback(
    async (accelerator: string) => {
      setShortcutError(null)
      const result = await window.toolbox.preferences.setShortcut(accelerator)
      if (!result.ok) setShortcutError(result.message)
      refresh()
    },
    [refresh]
  )

  useEffect(() => {
    if (!recording) return
    window.toolbox.preferences.suspendShortcut()
    let captured = false

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const accelerator = toAccelerator(event)
      if (accelerator) {
        captured = true
        setRecording(false)
        void apply(accelerator)
      }
    }
    // En phase de capture : Échap annule la saisie au lieu de fermer le panneau.
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (!captured) window.toolbox.preferences.resumeShortcut()
    }
  }, [recording, apply])

  // Panneau refermé pendant la saisie : on annule, sinon l'ancien raccourci resterait coupé.
  useEffect(() => {
    if (!panelOpen) setRecording(false)
  }, [panelOpen])

  async function toggleLoginItem(enabled: boolean): Promise<void> {
    setLoginError(null)
    const result = await window.toolbox.preferences.setLoginItem(enabled)
    if (!result.ok) setLoginError(result.message)
    refresh()
  }

  return (
    <>
      <section className="settings-section">
        <h2>Raccourci global</h2>
        <div className="settings-confirm">
          <span className="shortcut-value">
            {recording ? 'Appuie sur ta combinaison… (Échap pour annuler)' : shortcut ? formatAccelerator(shortcut.accelerator) : '…'}
          </span>
          {!recording && (
            <button type="button" className="button" onClick={() => setRecording(true)}>
              Modifier
            </button>
          )}
          {!recording && shortcut?.accelerator !== DEFAULT_SHORTCUT && (
            <button type="button" className="button" onClick={() => void apply(DEFAULT_SHORTCUT)}>
              Par défaut
            </button>
          )}
        </div>
        {shortcut && !shortcut.active && !recording && (
          <p className="form-error" role="alert">
            Ce raccourci ne répond pas : une autre app l'utilise déjà. Choisis-en un autre.
          </p>
        )}
        {shortcutError && (
          <p className="form-error" role="alert">
            {shortcutError}
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2>Démarrage</h2>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={loginItem}
            onChange={(event) => void toggleLoginItem(event.target.checked)}
          />
          Lancer Agent Toolbox à l'ouverture de ma session
        </label>
        {loginError && (
          <p className="form-error" role="alert">
            {loginError}
          </p>
        )}
        <p className="field-hint">Après une mise à jour du code, relance « npm run build » pour que le démarrage utilise la dernière version.</p>
      </section>
    </>
  )
}
