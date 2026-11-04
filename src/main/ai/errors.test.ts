import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { classifyError } from './errors'

const headers = (entries: Record<string, string> = {}): Headers => new Headers(entries)
const body = { type: 'error', error: { type: 'x', message: 'détail' } } as never

describe('classifyError', () => {
  it.each([
    [new Anthropic.AuthenticationError(401, body, 'x', headers()), 'invalid_key'],
    [new Anthropic.PermissionDeniedError(403, body, 'x', headers()), 'permission'],
    [new Anthropic.NotFoundError(404, body, 'x', headers()), 'not_found'],
    [new Anthropic.BadRequestError(400, body, 'x', headers()), 'bad_request'],
    [new Anthropic.RateLimitError(429, body, 'x', headers()), 'rate_limit'],
    [new Anthropic.InternalServerError(500, body, 'x', headers()), 'overloaded'],
    [new Anthropic.InternalServerError(529, body, 'x', headers()), 'overloaded'],
    [new Anthropic.APIError(402, body, 'x', headers()), 'billing'],
    [new Anthropic.APIConnectionError({ message: 'x' }), 'network'],
    [new Anthropic.APIConnectionTimeoutError(), 'network'],
    [new Error('autre'), 'unknown']
  ])('%o donne %s', (error, code) => {
    expect(classifyError(error).code).toBe(code)
  })

  it('annonce le délai de la limite de requêtes quand il est connu', () => {
    const error = new Anthropic.RateLimitError(429, body, 'x', headers({ 'retry-after': '30' }))
    expect(classifyError(error).message).toContain('30 s')
  })

  it('reste clair sans délai connu', () => {
    const error = new Anthropic.RateLimitError(429, body, 'x', headers())
    expect(classifyError(error).message).toContain('dans un instant')
  })
})
