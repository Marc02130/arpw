import type { SentenceAttribution } from './attribution'
import type { CitationCheckResult } from './citationCheck'
import type { FormatCheckResult } from './formatCheck'

export const DRAFT_DISCLAIMER =
  'AI-generated draft. Requires human review. Citations must match your uploaded sources. This is not a factual-accuracy score.'

export type DraftWarning = {
  kind: 'uncited' | 'citation' | 'format'
  message: string
}

export type DraftSegment = {
  text: string
  warning: boolean
}

export const previewWarnings = (input: {
  uncited: SentenceAttribution[]
  citationCheck: CitationCheckResult | null
  formatCheck: FormatCheckResult | null
}): DraftWarning[] => {
  const out: DraftWarning[] = []
  if (input.citationCheck && !input.citationCheck.ok) {
    for (const issue of input.citationCheck.issues) {
      if (issue.kind === 'unknown_sid' && issue.sid) {
        out.push({ kind: 'citation', message: `[${issue.sid}] is not in the retrieved set` })
      } else if (issue.kind === 'missing_paper_reference' && issue.fileId) {
        out.push({ kind: 'citation', message: `Cited file ${issue.fileId} is missing from paper_references` })
      }
    }
  }
  if (input.formatCheck && !input.formatCheck.ok) {
    for (const section of input.formatCheck.missing) {
      out.push({ kind: 'format', message: `Missing section heading: ${section}` })
    }
  }
  for (const row of input.uncited) {
    const snippet = row.sentence.length > 80 ? `${row.sentence.slice(0, 80)}…` : row.sentence
    out.push({ kind: 'uncited', message: `${row.section}: ${snippet}` })
  }
  return out
}

export const markUncitedInDraft = (
  content: string,
  uncited: SentenceAttribution[]
): DraftSegment[] => {
  if (!content) return []
  const needles = uncited.map((row) => row.sentence.trim()).filter(Boolean)
  if (needles.length === 0) return [{ text: content, warning: false }]

  const segments: DraftSegment[] = []
  let remaining = content
  while (remaining.length > 0) {
    let hit: { at: number; len: number } | null = null
    for (const sentence of needles) {
      const at = remaining.indexOf(sentence)
      if (at === -1) continue
      if (!hit || at < hit.at) hit = { at, len: sentence.length }
    }
    if (!hit) {
      segments.push({ text: remaining, warning: false })
      break
    }
    if (hit.at > 0) {
      segments.push({ text: remaining.slice(0, hit.at), warning: false })
    }
    segments.push({ text: remaining.slice(hit.at, hit.at + hit.len), warning: true })
    remaining = remaining.slice(hit.at + hit.len)
  }
  return segments
}
