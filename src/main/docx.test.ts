import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { markdownToDocx } from './docx'

const SAMPLE = `# Analyse SSH

Voici les **3 vérifications** à faire, avec un *script* de contrôle :

1. Désactiver la connexion root
2. Exiger les clés SSH
   - générer une clé ed25519
3. Installer fail2ban

| Réglage | Valeur |
|---|---|
| PermitRootLogin | no |

\`\`\`python
# scan_ssh.py
print("ok")
\`\`\`

> Garde une session ouverte pendant les tests.
`

describe('markdownToDocx', () => {
  it('produit un document Word lisible, avec le texte, la liste, le tableau et le code', async () => {
    const buffer = await markdownToDocx(SAMPLE, 'Analyse SSH')
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    const file = join(mkdtempSync(join(tmpdir(), 'docx-')), 'test.docx')
    writeFileSync(file, buffer)
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml']).toString()
    for (const text of ['Analyse SSH', '3 vérifications', 'Désactiver la connexion root', 'PermitRootLogin', 'print("ok")', 'Garde une session']) {
      expect(xml).toContain(text.replace(/"/g, '&quot;'))
    }
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('<w:numPr>')
  })
})
