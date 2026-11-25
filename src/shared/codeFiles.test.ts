import { describe, expect, it } from 'vitest'
import { documentFileName, extensionFor, languageOf, suggestFileName } from './codeFiles'

describe('languageOf et extensionFor', () => {
  it('lit la langue du bloc et donne la bonne extension', () => {
    expect(languageOf('language-python')).toBe('python')
    expect(languageOf('hljs language-TypeScript')).toBe('typescript')
    expect(languageOf(undefined)).toBeNull()
    expect(extensionFor('python')).toBe('py')
    expect(extensionFor('bash')).toBe('sh')
    expect(extensionFor('csv')).toBe('csv')
    expect(extensionFor('inconnu')).toBe('txt')
    expect(extensionFor(null)).toBe('txt')
  })
})

describe('suggestFileName', () => {
  it('reprend le nom que l’agent indique en tête du bloc', () => {
    expect(suggestFileName('# scan_ssh.py\nimport re', 'python')).toBe('scan_ssh.py')
    expect(suggestFileName('# fichier : analyse_auth.py\n', 'python')).toBe('analyse_auth.py')
    expect(suggestFileName('// config.json\n{}', 'json')).toBe('config.json')
    expect(suggestFileName('-- requetes.sql\nSELECT 1', 'sql')).toBe('requetes.sql')
  })

  it('reprend le nom annoncé juste avant le bloc', () => {
    expect(suggestFileName('import os', 'python', 'Voici le module.\n\n**`utils.py`**\n')).toBe('utils.py')
    expect(suggestFileName('x', 'python', '**`test_logique.py`** (teste la logique pure)\n')).toBe('test_logique.py')
    expect(suggestFileName('{}', 'json', 'Fichier `config/app.json` :\n')).toBe('app.json')
    // Un nom qui ne correspond pas à la langue du bloc est ignoré.
    expect(suggestFileName('import os', 'python', 'Voir aussi **`README.md`**\n')).toBe('script.py')
    // Seule la dernière ligne avant le bloc compte.
    expect(suggestFileName('import os', 'python', '**`ancien.py`**\n\nUn paragraphe.\n')).toBe('script.py')
  })

  it('refuse un chemin et garde seulement le nom', () => {
    expect(suggestFileName('# ../../etc/x.py\n', 'python')).toBe('script.py')
  })

  it('propose un nom générique sinon', () => {
    expect(suggestFileName('import os', 'python')).toBe('script.py')
    expect(suggestFileName('nom,email', 'csv')).toBe('donnees.csv')
    expect(suggestFileName('texte', null)).toBe('fichier.txt')
  })
})

describe('documentFileName', () => {
  it('fait un nom de fichier sûr à partir d’un titre', () => {
    expect(documentFileName('Campagne : Noël / 2026 ?', 'pdf')).toBe('Campagne-Noël-2026.pdf')
    expect(documentFileName('???', 'docx')).toBe('document.docx')
  })
})
