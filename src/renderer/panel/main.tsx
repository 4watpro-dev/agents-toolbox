import { createRoot } from 'react-dom/client'
import { Panel } from './Panel'
import './panel.css'

// Un fichier lâché hors d'un chat ne fait rien (sinon le navigateur tenterait de l'ouvrir).
for (const type of ['dragover', 'drop'] as const) {
  window.addEventListener(type, (event) => event.preventDefault())
}

createRoot(document.getElementById('root')!).render(<Panel />)
