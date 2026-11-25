// Nom de fichier proposé pour un bloc de code produit par un agent.

const EXTENSIONS: Record<string, string> = {
  python: 'py',
  py: 'py',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  json: 'json',
  csv: 'csv',
  tsv: 'tsv',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sql: 'sql',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  zsh: 'sh',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  markdown: 'md',
  md: 'md',
  java: 'java',
  kotlin: 'kt',
  swift: 'swift',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  powershell: 'ps1',
  ini: 'ini',
  dockerfile: 'Dockerfile',
  text: 'txt',
  txt: 'txt'
}

const BASE_NAMES: Record<string, string> = {
  py: 'script',
  sh: 'script',
  ps1: 'script',
  csv: 'donnees',
  tsv: 'donnees',
  json: 'donnees',
  html: 'page',
  sql: 'requete',
  md: 'document'
}

/** Langue du bloc, d'après sa classe Markdown (« language-python »). */
export function languageOf(className: string | undefined): string | null {
  const match = className?.match(/language-([\w+#-]+)/)
  return match ? match[1]!.toLowerCase() : null
}

export function extensionFor(language: string | null): string {
  return (language && EXTENSIONS[language]) || 'txt'
}

/** Nom sûr pour un fichier : ni chemin, ni caractère problématique. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  return base.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^\.+/, '').slice(0, 80)
}

const FILE_NAME = /[\w.-]*[\w-]\.[A-Za-z0-9]{1,8}\b/g

/**
 * Nom proposé : celui que l'agent annonce juste avant le bloc (« **`utils.py`** »),
 * ou en tête du bloc (« # scan_ssh.py »), sinon un nom générique.
 */
export function suggestFileName(code: string, language: string | null, before = ''): string {
  const extension = extensionFor(language)
  // Dernière ligne non vide avant le bloc : c'est là que l'agent nomme le fichier.
  const lead = before.trimEnd().split('\n').pop() ?? ''
  const announced = [...lead.matchAll(FILE_NAME)].map((match) => match[0])
  const fitting = announced.filter((name) => name.toLowerCase().endsWith(`.${extension.toLowerCase()}`))
  const chosen = fitting.at(-1) ?? (extension === 'txt' ? announced.at(-1) : undefined)
  if (chosen) {
    const name = safeFileName(chosen)
    if (name) return name
  }
  const firstLine = code.split('\n', 1)[0] ?? ''
  const named = firstLine.match(/^\s*(?:#|\/\/|--|<!--|\/\*)\s*(?:fichier|file(?:name)?|nom)?\s*:?\s*([\w.-]+\.[A-Za-z0-9]{1,8})\b/i)
  if (named) {
    const name = safeFileName(named[1]!)
    if (name) return name
  }
  if (extension === 'Dockerfile') return 'Dockerfile'
  return `${BASE_NAMES[extension] ?? 'fichier'}.${extension}`
}

/** Nom de fichier tiré d'un titre de conversation ou d'agent. */
export function documentFileName(title: string, extension: string): string {
  const base = title
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'document'}.${extension}`
}
