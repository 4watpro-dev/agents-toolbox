import { writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { documentFileName } from '../shared/codeFiles'
import { IPC, type TransferResult } from '../shared/ipc'
import { markdownToDocx } from './docx'
import { withPanelHidden } from './windows'

const CANCELED: TransferResult = { ok: true, value: { canceled: true, message: '' } }
const WRITE_FAILED: TransferResult = { ok: false, message: "Impossible d'écrire ce fichier. Choisis un autre emplacement." }

const FORMATS = {
  md: { name: 'Markdown', extension: 'md' },
  pdf: { name: 'PDF', extension: 'pdf' },
  docx: { name: 'Word', extension: 'docx' }
} as const

const ReplySchema = z.object({
  format: z.enum(['md', 'pdf', 'docx']),
  title: z.string().trim().min(1).max(200),
  markdown: z.string().min(1).max(2_000_000),
  /** HTML déjà rendu par l'app (react-markdown, sans HTML brut), pour le PDF. */
  html: z.string().max(4_000_000)
})

const TextFileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  content: z.string().max(5_000_000)
})

async function askPath(defaultPath: string, filter: { name: string; extensions: string[] }): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath, filters: [filter, { name: 'Tous les fichiers', extensions: ['*'] }] })
  return canceled || !filePath ? null : filePath
}

const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)

/** Page imprimable : mise en page claire, lisible en noir et blanc. */
export function printableHtml(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${escapeHtml(title)}</title>
<style>
  body { font: 11pt/1.55 -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1d2026; margin: 0; }
  header { border-bottom: 2px solid #c8f031; margin-bottom: 18px; padding-bottom: 8px; }
  header h1 { font-size: 17pt; margin: 0 0 2px; }
  header p { color: #6b7280; font-size: 9pt; margin: 0; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 18px 0 8px; }
  h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }
  p, ul, ol { margin: 0 0 10px; }
  li { margin: 2px 0; }
  code { font: 9.5pt ui-monospace, Menlo, monospace; background: #f1f2f4; border-radius: 3px; padding: 1px 4px; }
  pre { background: #f6f7f9; border: 1px solid #e3e5e8; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; word-break: break-word; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; font-size: 10pt; }
  th, td { border: 1px solid #d7dae0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eef0f3; }
  blockquote { border-left: 3px solid #c8f031; color: #4b5260; margin: 0 0 10px; padding: 2px 12px; }
  a { color: #2f6f3e; }
  hr { border: 0; border-top: 1px solid #d7dae0; margin: 16px 0; }
  .code-head, .code-actions, button { display: none !important; }
</style></head><body>
<header><h1>${escapeHtml(title)}</h1><p>Exporté depuis Agent Toolbox, le ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p></header>
${body}
</body></html>`
}

/** Rend le HTML dans une fenêtre invisible, sans JavaScript, et l'imprime en PDF. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await window.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.65, right: 0.65 }
    })
  } finally {
    window.destroy()
  }
}

async function exportReply(raw: unknown): Promise<TransferResult> {
  const parsed = ReplySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: 'Cette réponse ne peut pas être exportée.' }
  const { format, title, markdown, html } = parsed.data
  const { name, extension } = FORMATS[format]
  const path = await askPath(documentFileName(title, extension), { name, extensions: [extension] })
  if (!path) return CANCELED
  try {
    const content =
      format === 'md' ? `# ${title}\n\n${markdown.trim()}\n` : format === 'pdf' ? await htmlToPdf(printableHtml(title, html)) : await markdownToDocx(`# ${title}\n\n${markdown}`, title)
    await writeFile(path, content)
  } catch {
    return WRITE_FAILED
  }
  return { ok: true, value: { canceled: false, message: `Réponse exportée en ${name}.` } }
}

async function saveTextFile(raw: unknown): Promise<TransferResult> {
  const parsed = TextFileSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: 'Ce fichier ne peut pas être enregistré.' }
  const { name, content } = parsed.data
  const extension = name.includes('.') ? name.split('.').pop()! : 'txt'
  const path = await askPath(name, { name: extension.toUpperCase(), extensions: [extension] })
  if (!path) return CANCELED
  try {
    await writeFile(path, content.endsWith('\n') ? content : `${content}\n`, 'utf8')
  } catch {
    return WRITE_FAILED
  }
  return { ok: true, value: { canceled: false, message: `${path.split('/').pop()} enregistré.` } }
}

export function registerExportIpc(): void {
  ipcMain.handle(IPC.filesExportReply, (_event, payload: unknown) => withPanelHidden(() => exportReply(payload)))
  ipcMain.handle(IPC.filesSaveText, (_event, payload: unknown) => withPanelHidden(() => saveTextFile(payload)))
}
