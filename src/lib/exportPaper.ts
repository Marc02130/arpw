import { Document, HeadingLevel, Packer, Paragraph } from 'docx'
import { DRAFT_DISCLAIMER } from './draftPreview'

export type ExportPaperInput = {
  title: string
  content: string
  version?: number
}

export type WordBlock = {
  type: 'h1' | 'h2' | 'paragraph'
  text: string
}

export const exportFileStem = (title: string): string => {
  const stem = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return stem || 'paper'
}

export const exportFileName = (title: string, version: number | undefined, ext: 'md' | 'docx'): string => {
  const ver = typeof version === 'number' && version > 0 ? `-v${version}` : ''
  return `${exportFileStem(title)}${ver}.${ext}`
}

export const paperToMarkdown = (
  paper: ExportPaperInput,
  extras?: { checks?: string; disclaimer?: string }
): string => {
  const title = paper.title.trim() || 'Untitled paper'
  const parts = [`# ${title}`, (paper.content ?? '').trim()]
  if (extras?.checks?.trim()) parts.push(extras.checks.trim())
  parts.push('---', extras?.disclaimer?.trim() || DRAFT_DISCLAIMER)
  return `${parts.filter((part) => part.length > 0).join('\n\n')}\n`
}

export const paperToBlocks = (
  paper: ExportPaperInput,
  extras?: { checks?: string; disclaimer?: string }
): WordBlock[] => {
  const blocks: WordBlock[] = [{ type: 'h1', text: paper.title.trim() || 'Untitled paper' }]
  for (const raw of (paper.content ?? '').split('\n')) {
    const line = raw.trimEnd()
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'h2', text: heading[1].trim() })
      continue
    }
    if (line.trim()) blocks.push({ type: 'paragraph', text: line.trim() })
  }
  if (extras?.checks?.trim()) {
    blocks.push({ type: 'h2', text: 'Checks' })
    for (const line of extras.checks.split('\n')) {
      const text = line.replace(/^- /, '').trim()
      if (text) blocks.push({ type: 'paragraph', text })
    }
  }
  blocks.push({ type: 'paragraph', text: extras?.disclaimer?.trim() || DRAFT_DISCLAIMER })
  return blocks
}

export const paperToDocxBlob = async (
  paper: ExportPaperInput,
  extras?: { checks?: string; disclaimer?: string }
): Promise<Blob> => {
  const blocks = paperToBlocks(paper, extras)
  const doc = new Document({
    sections: [
      {
        children: blocks.map((block) => {
          if (block.type === 'h1') {
            return new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_1 })
          }
          if (block.type === 'h2') {
            return new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_2 })
          }
          return new Paragraph({ text: block.text })
        }),
      },
    ],
  })
  return Packer.toBlob(doc)
}

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const checksExportBlock = (warnings: Array<{ message: string }>): string => {
  if (warnings.length === 0) return 'Checks: no citation, format, or uncited warnings.'
  return `Checks:\n${warnings.map((warning) => `- ${warning.message}`).join('\n')}`
}
