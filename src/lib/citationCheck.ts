import type { SentenceAttribution } from './attribution'
import { extractSids } from './citations'
import { uniqueFileIds } from './papers'

export type CitationCheckIssue = {
  kind: 'unknown_sid' | 'missing_paper_reference'
  sid?: string
  fileId?: string
}

export type CitationCheckResult = {
  ok: boolean
  citedSids: string[]
  citedFileIds: string[]
  issues: CitationCheckIssue[]
}

export const citationInputsFromAttribution = (
  content: string,
  rows: SentenceAttribution[]
): { allowedSids: string[]; citedFileIds: string[] } => {
  const inContent = new Set(extractSids(content))
  const allowedSids = uniqueFileIds(rows.flatMap((row) => row.citedSids))
  const citedFileIds = uniqueFileIds(
    rows.flatMap((row) => (row.citedSids.some((sid) => inContent.has(sid)) ? row.fileIds : []))
  )
  return { allowedSids, citedFileIds }
}

export const runCitationCheck = (input: {
  content: string
  allowedSids: Iterable<string>
  citedFileIds: Iterable<string>
  paperReferenceFileIds: Iterable<string>
}): CitationCheckResult => {
  const allowed = new Set([...input.allowedSids].filter(Boolean))
  const paperRefs = new Set([...input.paperReferenceFileIds].filter(Boolean))
  const citedSids = extractSids(input.content)
  const citedFileIds = uniqueFileIds([...input.citedFileIds])
  const issues: CitationCheckIssue[] = []

  for (const sid of citedSids) {
    if (!allowed.has(sid)) {
      issues.push({ kind: 'unknown_sid', sid })
    }
  }
  for (const fileId of citedFileIds) {
    if (!paperRefs.has(fileId)) {
      issues.push({ kind: 'missing_paper_reference', fileId })
    }
  }

  return {
    ok: issues.length === 0,
    citedSids,
    citedFileIds,
    issues,
  }
}

export const citationCheckLabel = (result: CitationCheckResult): string => {
  if (result.ok) {
    const n = result.citedSids.length
    return n === 0
      ? 'Citation check passed (no [S#] citations).'
      : `Citation check passed (${n} [S#] in the retrieved set and paper_references).`
  }
  const unknown = result.issues.filter((issue) => issue.kind === 'unknown_sid').length
  const missing = result.issues.filter((issue) => issue.kind === 'missing_paper_reference').length
  const parts: string[] = []
  if (unknown) parts.push(`${unknown} not in the retrieved set`)
  if (missing) parts.push(`${missing} missing from paper_references`)
  return `Citation check failed: ${parts.join('; ')}.`
}
