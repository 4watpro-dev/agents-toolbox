export const DEFAULT_SHORTCUT = 'Command+Shift+Space'

export interface KeyPress {
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Return',
  Tab: 'Tab',
  Backspace: 'Backspace',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\'
}

/**
 * On lit `code` plutôt que `key` : sur Mac, Option transforme la lettre tapée
 * (Option+A donne « æ »), alors que la touche physique reste la même.
 */
function keyName(code: string): string | null {
  const letter = code.match(/^Key([A-Z])$/)
  if (letter) return letter[1]
  const digit = code.match(/^Digit(\d)$/)
  if (digit) return digit[1]
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code
  return NAMED_KEYS[code] ?? null
}

/** Traduit une touche pressée en raccourci Electron, ou `null` si elle ne peut pas en être un. */
export function toAccelerator(press: KeyPress): string | null {
  const key = keyName(press.code)
  if (!key) return null
  const modifiers = [
    press.metaKey && 'Command',
    press.ctrlKey && 'Control',
    press.altKey && 'Alt',
    press.shiftKey && 'Shift'
  ].filter((modifier): modifier is string => Boolean(modifier))
  // Sans vrai modificateur, le raccourci prendrait la touche à toutes les autres apps.
  // Maj seul ne suffit pas, sauf pour les touches de fonction.
  const hasStrongModifier = press.metaKey || press.ctrlKey || press.altKey
  if (!hasStrongModifier && !key.startsWith('F')) return null
  return [...modifiers, key].join('+')
}

const DISPLAY: Record<string, string> = {
  Command: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Space: 'Espace',
  Return: '↩',
  Backspace: '⌫',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→'
}

/** Écriture lisible d'un raccourci. Le signe plus sert de séparateur, jamais de touche ici. */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => DISPLAY[part] ?? part)
    .join(' ')
}
