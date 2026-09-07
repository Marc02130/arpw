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

export const citedSids = (text: string, allowed: Set<string>): string[] => {
  const found = text.match(CITE) ?? []
  const ids = found.map((token) => token.slice(1, -1)).filter((id) => allowed.has(id))
  return [...new Set(ids)]
}

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
