import type { Confirmation, ConfirmationOutcome } from './connectors'
import type { Mood } from './replyParser'
import type { ToolActivity } from './tools'

export type ChatErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'not_logged_in'
  | 'not_on_plan'
  | 'cli_missing'
  | 'plan_limit'
  | 'permission'
  | 'billing'
  | 'rate_limit'
  | 'overloaded'
  | 'network'
  | 'not_found'
  | 'bad_request'
  | 'refusal'
  | 'unknown'

export interface ChatFailure {
  code: ChatErrorCode
  message: string
}

export type ChatEvent = { sessionId: string } & (
  | { type: 'delta'; text: string }
  | { type: 'tool'; activity: ToolActivity }
  | { type: 'confirm'; confirmation: Confirmation }
  | { type: 'confirmed'; id: string; outcome: ConfirmationOutcome }
  | { type: 'notice'; text: string }
  | { type: 'done'; mood: Mood; truncated: boolean; facts: string[] }
  | { type: 'stopped' }
  | { type: 'error'; failure: ChatFailure }
)
