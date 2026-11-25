import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild
} from 'docx'
import type { Root, RootContent, PhrasingContent, ListItem } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
const CODE_FONT = 'Menlo'
/** Largeur utile d'une page A4 avec des marges d'un pouce, en vingtièmes de point. */
const PAGE_WIDTH = 9000
const BULLETS = 'puces'
const NUMBERS = 'numeros'

interface Marks {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  code?: boolean
}

/** Texte en ligne (gras, italique, code, liens) vers des morceaux de paragraphe Word. */
function inline(nodes: PhrasingContent[], marks: Marks = {}): ParagraphChild[] {
  return nodes.flatMap((node): ParagraphChild[] => {
    switch (node.type) {
      case 'text':
        return [new TextRun({ text: node.value, bold: marks.bold, italics: marks.italics, strike: marks.strike })]
      case 'strong':
        return inline(node.children, { ...marks, bold: true })
      case 'emphasis':
        return inline(node.children, { ...marks, italics: true })
      case 'delete':
        return inline(node.children, { ...marks, strike: true })
      case 'inlineCode':
        return [new TextRun({ text: node.value, font: CODE_FONT, bold: marks.bold, shading: { type: ShadingType.CLEAR, fill: 'F1F2F4' } })]
      case 'break':
        return [new TextRun({ break: 1 })]
      case 'link':
        return [new ExternalHyperlink({ link: node.url, children: [new TextRun({ text: plainText(node.children), style: 'Hyperlink' })] })]
      default:
        return 'children' in node ? inline(node.children as PhrasingContent[], marks) : 'value' in node ? [new TextRun(String(node.value))] : []
    }
  })
}

function plainText(nodes: PhrasingContent[]): string {
  return nodes.map((node) => ('value' in node ? node.value : 'children' in node ? plainText(node.children as PhrasingContent[]) : '')).join('')
}

/** Blocs Markdown vers paragraphes et tableaux Word. `level` : profondeur dans une liste. */
function blocks(nodes: RootContent[], level = 0): (Paragraph | Table)[] {
  return nodes.flatMap((node): (Paragraph | Table)[] => {
    switch (node.type) {
      case 'heading':
        return [new Paragraph({ heading: HEADINGS[node.depth - 1], children: inline(node.children) })]
      case 'paragraph':
        return [new Paragraph({ children: inline(node.children), spacing: { after: 120 } })]
      case 'list':
        return node.children.flatMap((item) => listItem(item, level, Boolean(node.ordered)))
      case 'blockquote':
        // Citation : en retrait, en italique, avec un filet à gauche.
        return node.children.flatMap((child) =>
          child.type === 'paragraph'
            ? [
                new Paragraph({
                  children: inline(child.children, { italics: true }),
                  indent: { left: 400 },
                  border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'C8F031', space: 8 } },
                  spacing: { after: 120 }
                })
              ]
            : blocks([child], level)
        )
      case 'code':
        return node.value.split('\n').map(
          (line, index, lines) =>
            new Paragraph({
              children: [new TextRun({ text: line || ' ', font: CODE_FONT, size: 18 })],
              shading: { type: ShadingType.CLEAR, fill: 'F1F2F4' },
              spacing: { before: index === 0 ? 120 : 0, after: index === lines.length - 1 ? 160 : 0 }
            })
        )
      case 'thematicBreak':
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } } })]
      case 'table': {
        // Largeur fixe en vingtièmes de point : Word, Pages et Aperçu l'affichent pareil.
        const columns = Math.max(1, node.children[0]?.children.length ?? 1)
        const columnWidth = Math.floor(PAGE_WIDTH / columns)
        return [
          new Table({
            width: { size: columnWidth * columns, type: WidthType.DXA },
            columnWidths: Array.from({ length: columns }, () => columnWidth),
            rows: node.children.map(
              (row, rowIndex) =>
                new TableRow({
                  tableHeader: rowIndex === 0,
                  children: row.children.map(
                    (cell) =>
                      new TableCell({
                        width: { size: columnWidth, type: WidthType.DXA },
                        margins: { top: 60, bottom: 60, left: 100, right: 100 },
                        children: [new Paragraph({ children: inline(cell.children, { bold: rowIndex === 0 }) })],
                        ...(rowIndex === 0 ? { shading: { type: ShadingType.CLEAR, fill: 'EEF0F3' } } : {})
                      })
                  )
                })
            )
          }),
          new Paragraph({ children: [] })
        ]
      }
      case 'html':
        // Le HTML brut n'est pas interprété, comme dans l'app : il reste du texte.
        return [new Paragraph({ children: [new TextRun(node.value)] })]
      default:
        return []
    }
  })
}

function listItem(item: ListItem, level: number, ordered: boolean): (Paragraph | Table)[] {
  const [first, ...rest] = item.children
  const lead =
    first?.type === 'paragraph'
      ? [new Paragraph({ children: inline(first.children), numbering: { reference: ordered ? NUMBERS : BULLETS, level: Math.min(level, 2) } })]
      : []
  const others = first?.type === 'paragraph' ? rest : item.children
  return [...lead, ...blocks(others, level + 1)]
}

/** Réponse d'un agent (Markdown) mise en forme dans un document Word. */
export async function markdownToDocx(markdown: string, title: string): Promise<Buffer> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root
  const levels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (level: number) => string) =>
    [0, 1, 2].map((level) => ({
      level,
      format,
      text: text(level),
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } } }
    }))
  const document = new Document({
    title,
    creator: 'Agent Toolbox',
    styles: { default: { document: { run: { font: 'Helvetica', size: 22 } } } },
    numbering: {
      config: [
        { reference: BULLETS, levels: levels(LevelFormat.BULLET, (level) => ['•', '◦', '▪'][level]!) },
        { reference: NUMBERS, levels: levels(LevelFormat.DECIMAL, (level) => `%${level + 1}.`) }
      ]
    },
    sections: [{ children: blocks(tree.children) }]
  })
  return Packer.toBuffer(document)
}
