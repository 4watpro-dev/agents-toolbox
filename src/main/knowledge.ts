import { realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

/**
 * Dossiers trop larges ou trop sensibles pour servir de base de documents : ils
 * contiennent des réglages, des mots de passe ou toute la vie de la personne.
 */
function forbiddenFolders(): string[] {
  const home = homedir()
  return ['/', '/Users', '/System', '/Library', '/private', '/etc', '/var', home, join(home, 'Library'), join(home, '.ssh')]
}

export type KnowledgeFolder = { ok: true; path: string; name: string } | { ok: false; message: string }

/** Vérifie un dossier de documents et renvoie son chemin réel (liens symboliques résolus). */
export function resolveKnowledgeFolder(path: string): KnowledgeFolder {
  let real: string
  try {
    real = realpathSync(path)
    if (!statSync(real).isDirectory()) return { ok: false, message: "Ce n'est pas un dossier." }
  } catch {
    return { ok: false, message: `Le dossier de documents est introuvable : ${path}` }
  }
  const forbidden = forbiddenFolders().map((folder) => {
    try {
      return realpathSync(folder)
    } catch {
      return folder
    }
  })
  if (forbidden.includes(real)) {
    return { ok: false, message: 'Ce dossier est trop large ou trop sensible. Choisis un dossier qui ne contient que les documents de cet agent.' }
  }
  return { ok: true, path: real, name: basename(real) }
}
