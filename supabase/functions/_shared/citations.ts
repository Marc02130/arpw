import {
  emptyBibliographicRecord,
  formatBibliographicCitation,
  type BibliographicRecord,
} from './bibliographicCitation.ts'

const CITE = /\[S\d+\]/g

export type NumberedSource = {
  sid: string
  vector_id: string
  file_id: string
  chunk_text: string
}

export const numberSources = (
  passages: Array<{ vector_id: string; file_id: string; chunk_text: string }>
): NumberedSource[] =>
  passages.map((passage, index) => ({
    sid: `S${index + 1}`,
    vector_id: passage.vector_id,
    file_id: passage.file_id,
    chunk_text: passage.chunk_text,
  }))

export const allowedSidSet = (sources: NumberedSource[]): Set<string> =>
  new Set(sources.map((source) => source.sid))

export const formatSourcesForPrompt = (sources: NumberedSource[]): string => {
  if (sources.length === 0) {
    return 'No retrieved sources. Do not invent citations. Write only from the research prompt if you must, and include no [S#] citations.'
  }
  return sources
    .map((source) => `[${source.sid}] ${source.chunk_text}`)
    .join('\n\n')
}

export const extractSids = (text: string): string[] => {
  const found = text.match(CITE) ?? []
  return [...new Set(found.map((token) => token.slice(1, -1)))]
}

export const citedSids = (text: string, allowed: Set<string>): string[] =>
  extractSids(text).filter((id) => allowed.has(id))

export const stripUnknownCitations = (text: string, allowed: Set<string>): string => {
  const stripped = text.replace(CITE, (token) => {
    const id = token.slice(1, -1)
    return allowed.has(id) ? token : ''
  })
  return stripped.replace(/[ \t]+\n/g, '\n').replace(/  +/g, ' ').replace(/ +([.,;:])/g, '$1').trim()
}

export const fileIdsForSids = (sids: string[], sources: NumberedSource[]): string[] => {
  const wanted = new Set(sids)
  return [...new Set(sources.filter((source) => wanted.has(source.sid)).map((source) => source.file_id))]
}

export type CitedWork = {
  file_id: string
  file_name?: string | null
  bibliographic?: BibliographicRecord | null
}

export const EMPTY_REFERENCES =
  'No works were cited in earlier sections. References are catalog records (Crossref/PubMed) for DOIs or PMIDs on the cited uploads.'

export const formatReferencesList = (files: CitedWork[], citationStyle = 'APA'): string => {
  if (files.length === 0) return EMPTY_REFERENCES
  const formatted: string[] = []
  const incomplete: string[] = []
  for (const file of files) {
    const rec = file.bibliographic ?? emptyBibliographicRecord()
    const line = formatBibliographicCitation(rec, citationStyle)
    if (line) formatted.push(line)
    else if (file.file_name || file.file_id) incomplete.push(file.file_name || file.file_id)
  }
  formatted.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  if (formatted.length === 0 && incomplete.length === 0) return EMPTY_REFERENCES
  const parts = [...formatted]
  if (incomplete.length) {
    parts.push(
      `${incomplete.length} cited upload${incomplete.length === 1 ? '' : 's'} had no DOI/PMID catalog record and ${incomplete.length === 1 ? 'is' : 'are'} not formatted as ${citationStyle} references.`
    )
  }
  return parts.join('\n\n')
}
