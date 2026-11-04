import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { AgentTools } from '../../shared/tools'
import { WEB_GUARD_SCRIPT, webToolArgs } from './webGuard'

const directory = mkdtempSync(join(tmpdir(), 'web-guard-'))
const script = join(directory, 'guard.cjs')
writeFileSync(script, WEB_GUARD_SCRIPT)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

const ALL: AgentTools = { webSearch: true, webFetch: true, allowedDomains: ['brevo.com'] }

function run(policy: AgentTools | string, tool_name: string, tool_input: unknown) {
  const argument = typeof policy === 'string' ? policy : Buffer.from(JSON.stringify(policy)).toString('base64')
  const result = spawnSync(process.execPath, [script, argument], { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' })
  return { status: result.status, output: result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : null }
}

describe('contrôle des outils web', () => {
  it('accepte le domaine autorisé et ses sous-domaines', () => {
    for (const url of ['https://brevo.com/a', 'https://help.brevo.com/a', 'https://HELP.brevo.com./a']) {
      expect(run(ALL, 'WebFetch', { url }).output.permissionDecision).toBe('allow')
    }
  })

  it('refuse tout le reste, y compris les sites préapprouvés par Claude Code', () => {
    for (const url of ['https://docs.python.org/3/', 'https://brevo.com.evil.org/', 'https://evilbrevo.com/', 'https://brevo.com@evil.org/']) {
      expect(run(ALL, 'WebFetch', { url }).output.permissionDecision).toBe('deny')
    }
  })

  it('refuse une adresse qui ne mène pas au web', () => {
    expect(run(ALL, 'WebFetch', { url: 'file:///etc/passwd' }).output.permissionDecision).toBe('deny')
  })

  it('impose la liste à la recherche, quoi que demande le modèle', () => {
    const { output } = run(ALL, 'WebSearch', { query: 'tarifs', allowed_domains: ['evil.org'], blocked_domains: ['brevo.com'] })
    expect(output.permissionDecision).toBe('allow')
    expect(output.updatedInput).toEqual({ query: 'tarifs', allowed_domains: ['brevo.com'] })
  })

  it('laisse tout passer sans liste', () => {
    const open: AgentTools = { webSearch: true, webFetch: true, allowedDomains: [] }
    expect(run(open, 'WebFetch', { url: 'https://example.org/' }).output.permissionDecision).toBe('allow')
    const { output } = run(open, 'WebSearch', { query: 'tarifs' })
    expect(output.permissionDecision).toBe('allow')
    expect(output.updatedInput).toBeUndefined()
  })

  it("refuse un outil que l'agent n'a pas activé", () => {
    const searchOnly: AgentTools = { webSearch: true, webFetch: false, allowedDomains: [] }
    expect(run(searchOnly, 'WebFetch', { url: 'https://example.org/' }).output.permissionDecision).toBe('deny')
    expect(run(ALL, 'Bash', { command: 'ls' }).output.permissionDecision).toBe('deny')
  })

  it('bloque au moindre problème', () => {
    expect(run('pas-du-json', 'WebFetch', { url: 'https://brevo.com/' }).status).toBe(2)
    expect(run(ALL, 'WebFetch', { url: 'pas une adresse' }).status).toBe(2)
  })
})

describe('webToolArgs', () => {
  it("n'expose que les outils activés et protège les chemins avec espaces", () => {
    const args = webToolArgs({ webSearch: false, webFetch: true, allowedDomains: [] }, '/App Support/Electron', "/l'app/guard.cjs")
    expect(args.tools).toBe('WebFetch')
    const command = JSON.parse(args.settings).hooks.PreToolUse[0].hooks[0].command as string
    expect(command).toContain("ELECTRON_RUN_AS_NODE=1 '/App Support/Electron' '/l'\\''app/guard.cjs'")
  })
})
