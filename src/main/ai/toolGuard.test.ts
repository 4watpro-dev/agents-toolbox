import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { connectorConfig, TOOL_GUARD_SCRIPT, toolGuardArgs } from './toolGuard'

const directory = mkdtempSync(join(tmpdir(), 'tool-guard-'))
const script = join(directory, 'guard.cjs')
writeFileSync(script, TOOL_GUARD_SCRIPT)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

interface Policy {
  webSearch: boolean
  webFetch: boolean
  allowedDomains: string[]
  bridge?: { socket: string; runId: string } | null
  knowledge?: string | null
}

const ALL: Policy = { webSearch: true, webFetch: true, allowedDomains: ['brevo.com'] }

function run(policy: Policy | string, tool_name: string, tool_input: unknown) {
  const argument = typeof policy === 'string' ? policy : Buffer.from(JSON.stringify(policy)).toString('base64')
  return new Promise<{ status: number | null; output: Record<string, unknown> }>((resolve) => {
    const child = spawn(process.execPath, [script, argument])
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stdin.end(JSON.stringify({ tool_name, tool_input }))
    child.on('close', (status) => resolve({ status, output: stdout ? JSON.parse(stdout).hookSpecificOutput : {} }))
  })
}

describe('contrôle des outils web', () => {
  it('accepte le domaine autorisé et ses sous-domaines', async () => {
    for (const url of ['https://brevo.com/a', 'https://help.brevo.com/a', 'https://HELP.brevo.com./a']) {
      expect((await run(ALL, 'WebFetch', { url })).output.permissionDecision).toBe('allow')
    }
  })

  it('refuse tout le reste, y compris les sites préapprouvés par Claude Code', async () => {
    for (const url of ['https://docs.python.org/3/', 'https://brevo.com.evil.org/', 'https://evilbrevo.com/', 'https://brevo.com@evil.org/']) {
      expect((await run(ALL, 'WebFetch', { url })).output.permissionDecision).toBe('deny')
    }
  })

  it('refuse une adresse qui ne mène pas au web', async () => {
    expect((await run(ALL, 'WebFetch', { url: 'file:///etc/passwd' })).output.permissionDecision).toBe('deny')
  })

  it('impose la liste à la recherche, quoi que demande le modèle', async () => {
    const { output } = await run(ALL, 'WebSearch', { query: 'tarifs', allowed_domains: ['evil.org'], blocked_domains: ['brevo.com'] })
    expect(output.permissionDecision).toBe('allow')
    expect(output.updatedInput).toEqual({ query: 'tarifs', allowed_domains: ['brevo.com'] })
  })

  it('sans liste, laisse passer la recherche mais pas une page, faute de quelqu\'un pour confirmer', async () => {
    const open: Policy = { webSearch: true, webFetch: true, allowedDomains: [] }
    expect((await run(open, 'WebFetch', { url: 'https://example.org/' })).output.permissionDecision).toBe('deny')
    const { output } = await run(open, 'WebSearch', { query: 'tarifs' })
    expect(output.permissionDecision).toBe('allow')
    expect(output.updatedInput).toBeUndefined()
  })

  it("refuse un outil que l'agent n'a pas activé", async () => {
    const searchOnly: Policy = { webSearch: true, webFetch: false, allowedDomains: [] }
    expect((await run(searchOnly, 'WebFetch', { url: 'https://example.org/' })).output.permissionDecision).toBe('deny')
    expect((await run(ALL, 'Bash', { command: 'ls' })).output.permissionDecision).toBe('deny')
  })

  it('bloque au moindre problème', async () => {
    expect((await run('pas-du-json', 'WebFetch', { url: 'https://brevo.com/' })).status).toBe(2)
    expect((await run(ALL, 'WebFetch', { url: 'pas une adresse' })).status).toBe(2)
  })
})

describe('contrôle des connecteurs', () => {
  const socket = join(directory, 'bridge.sock')

  async function withApp(answer: (request: string, reply: (line: string | null) => void) => void, act: () => Promise<void>) {
    const received: string[] = []
    const server: Server = createServer((connection) => {
      connection.setEncoding('utf8')
      connection.on('data', (request: string) => {
        received.push(request)
        answer(request, (line) => (line === null ? connection.destroy() : connection.end(line)))
      })
    })
    await new Promise<void>((resolve) => server.listen(socket, resolve))
    await act()
    await new Promise((resolve) => server.close(resolve))
    return received
  }

  const policy: Policy = { ...ALL, bridge: { socket, runId: 'tour-1' } }

  it("transmet l'appel à l'app et applique sa décision", async () => {
    let result = await Promise.resolve(null as Awaited<ReturnType<typeof run>> | null)
    const received = await withApp(
      (_request, reply) => reply('{"decision":"deny","reason":"La personne a refusé cette action."}\n'),
      async () => {
        result = await run(policy, 'mcp__brevo__send_campaign', { name: 'Noël' })
      }
    )
    expect(JSON.parse(received[0])).toEqual({ runId: 'tour-1', tool: 'mcp__brevo__send_campaign', input: { name: 'Noël' } })
    expect(result!.output).toMatchObject({ permissionDecision: 'deny', permissionDecisionReason: 'La personne a refusé cette action.' })
  })

  it("n'autorise que sur un « allow » explicite de l'app", async () => {
    let allow = null as Awaited<ReturnType<typeof run>> | null
    let other = null as Awaited<ReturnType<typeof run>> | null
    await withApp(
      (request, reply) => reply(request.includes('get_stats') ? '{"decision":"allow","reason":"Lecture."}\n' : '{"decision":"oui","reason":"?"}\n'),
      async () => {
        allow = await run(policy, 'mcp__brevo__get_stats', {})
        other = await run(policy, 'mcp__brevo__send_campaign', {})
      }
    )
    expect(allow!.output.permissionDecision).toBe('allow')
    expect(other!.output.permissionDecision).toBe('deny')
  })

  it("bloque si l'app est absente, coupe le canal ou répond n'importe quoi", async () => {
    expect((await run(policy, 'mcp__brevo__send_campaign', {})).status).toBe(2)
    let cut = null as Awaited<ReturnType<typeof run>> | null
    await withApp(
      (_request, reply) => reply(null),
      async () => {
        cut = await run(policy, 'mcp__brevo__send_campaign', {})
      }
    )
    expect(cut!.status).toBe(2)
    let garbage = null as Awaited<ReturnType<typeof run>> | null
    await withApp(
      (_request, reply) => reply('pas du json\n'),
      async () => {
        garbage = await run(policy, 'mcp__brevo__send_campaign', {})
      }
    )
    expect(garbage!.status).toBe(2)
  })

  it("demande à l'app pour une page hors de la liste, avec l'adresse complète", async () => {
    let result = null as Awaited<ReturnType<typeof run>> | null
    let listed = null as Awaited<ReturnType<typeof run>> | null
    const received = await withApp(
      (_request, reply) => reply('{"decision":"allow","reason":"Confirmé par la personne."}\n'),
      async () => {
        result = await run(policy, 'WebFetch', { url: 'https://evil.org/?d=secret', prompt: 'résume' })
        listed = await run(policy, 'WebFetch', { url: 'https://brevo.com/' })
      }
    )
    expect(received.map((line) => JSON.parse(line))).toEqual([{ runId: 'tour-1', tool: 'WebFetch', input: { url: 'https://evil.org/?d=secret' } }])
    expect(result!.output.permissionDecision).toBe('allow')
    expect(listed!.output.permissionDecision).toBe('allow')
  })

  it("ne demande rien pour une adresse qui ne mène pas au web", async () => {
    expect((await run(policy, 'WebFetch', { url: 'file:///etc/passwd' })).output.permissionDecision).toBe('deny')
  })

  it('refuse un connecteur quand aucun canal n\'est prévu', async () => {
    expect((await run(ALL, 'mcp__brevo__get_stats', {})).output.permissionDecision).toBe('deny')
  })
})

describe('toolGuardArgs', () => {
  it("n'expose que les outils activés et protège les chemins avec espaces", () => {
    const args = toolGuardArgs({ webSearch: false, webFetch: true, allowedDomains: [], connectors: [], knowledgeFolder: null }, null, null, ["/App Support/l'app"])
    expect(args.tools).toBe('WebFetch')
    const command = JSON.parse(args.settings).hooks.PreToolUse[0].hooks[0].command as string
    expect(command.startsWith("'/App Support/l'\\''app' '--agent-toolbox-tool-guard' '")).toBe(true)
    // Plus de mode Node : il est coupé dans l'app installée.
    expect(command).not.toContain('ELECTRON_RUN_AS_NODE')
  })
})

describe('connectorConfig', () => {
  it('ne produit rien sans connecteur', () => {
    expect(connectorConfig([]).mcpConfig).toBeNull()
  })

  it("garde les jetons hors de la configuration et de la ligne de commande", () => {
    const { mcpConfig, env, labels } = connectorConfig([
      { name: 'Brevo', url: 'https://mcp.brevo.com/v1/brevo/mcp', token: 'secret' },
      { name: 'Brevo', url: 'https://autre.example/mcp', token: null }
    ])
    expect(mcpConfig).not.toContain('secret')
    expect(env).toEqual({ AT_MCP_TOKEN_0: 'secret' })
    expect(labels).toEqual({ brevo: 'Brevo', 'brevo-2': 'Brevo' })
    expect(JSON.parse(mcpConfig!).mcpServers).toEqual({
      brevo: { type: 'http', url: 'https://mcp.brevo.com/v1/brevo/mcp', headers: { Authorization: 'Bearer ${AT_MCP_TOKEN_0}' } },
      'brevo-2': { type: 'http', url: 'https://autre.example/mcp' }
    })
  })
})

describe('contrôle du dossier de documents', () => {
  // Chemins réels : sur macOS, /var/folders est un lien vers /private/var/folders.
  const base = realpathSync(directory)
  const docs = join(base, 'docs')
  const secret = join(base, 'secret.txt')
  mkdirSync(join(docs, 'sous-dossier'), { recursive: true })
  writeFileSync(join(docs, 'brief.md'), '# Brief')
  writeFileSync(join(docs, 'sous-dossier', 'note.txt'), 'note')
  writeFileSync(secret, 'secret')
  symlinkSync(secret, join(docs, 'raccourci.txt'))
  const policy: Policy = { webSearch: false, webFetch: false, allowedDomains: [], knowledge: docs }
  const decision = async (tool: string, input: unknown) => (await run(policy, tool, input)).output

  it('laisse lire les fichiers du dossier, sous-dossiers compris', async () => {
    expect((await decision('Read', { file_path: join(docs, 'brief.md') })).permissionDecision).toBe('allow')
    expect((await decision('Read', { file_path: join(docs, 'sous-dossier', 'note.txt') })).permissionDecision).toBe('allow')
  })

  it('refuse tout fichier hors du dossier, même par un lien ou un « .. »', async () => {
    expect((await decision('Read', { file_path: secret })).permissionDecision).toBe('deny')
    expect((await decision('Read', { file_path: join(docs, '..', 'secret.txt') })).permissionDecision).toBe('deny')
    expect((await decision('Read', { file_path: join(docs, 'raccourci.txt') })).permissionDecision).toBe('deny')
    expect((await decision('Read', { file_path: '/etc/hosts' })).permissionDecision).toBe('deny')
    expect((await decision('Read', { file_path: join(docs, 'absent.md') })).permissionDecision).toBe('deny')
  })

  it('cherche dans le dossier par défaut, jamais ailleurs', async () => {
    const glob = await decision('Glob', { pattern: '**/*.md' })
    expect(glob.permissionDecision).toBe('allow')
    expect(glob.updatedInput).toEqual({ pattern: '**/*.md', path: docs })
    expect((await decision('Grep', { pattern: 'Brief', path: join(docs, 'sous-dossier') })).permissionDecision).toBe('allow')
    expect((await decision('Grep', { pattern: 'x', path: base })).permissionDecision).toBe('deny')
    expect((await decision('Glob', { pattern: '../**' })).permissionDecision).toBe('deny')
    expect((await decision('Glob', { pattern: '/etc/*' })).permissionDecision).toBe('deny')
    expect((await decision('Grep', { pattern: 'x', glob: '../*' })).permissionDecision).toBe('deny')
  })

  it("refuse l'écriture et le terminal, même avec un dossier", async () => {
    for (const tool of ['Write', 'Edit', 'Bash']) {
      expect((await decision(tool, { file_path: join(docs, 'brief.md'), command: 'ls' })).permissionDecision).toBe('deny')
    }
  })

  it('donne les outils de lecture et ouvre le dossier', () => {
    const args = toolGuardArgs({ webSearch: false, webFetch: false, allowedDomains: [], connectors: [], knowledgeFolder: docs }, null, null, ['/Applications/Agent Toolbox.app/Contents/MacOS/Agent Toolbox'], docs)
    expect(args.tools).toBe('Read,Glob,Grep')
    expect(args.addDir).toBe(docs)
  })
})
