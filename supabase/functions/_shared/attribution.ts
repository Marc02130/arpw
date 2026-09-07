import { citedSids, type NumberedSource } from './citations.ts'

export type QuoteSpan = {
  sid: string
  quote: string
}

export type SentenceAttribution = {
  sentence: string
  section: string
  citedSids: string[]
  vectorIds: string[]
  fileIds: string[]
  quoteSpans: QuoteSpan[]
  uncited: boolean
}

const QUOTE = /"([^"]{8,})"|“([^”]{8,})”/g

export const splitSentences = (text: string): string[] => {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const parts: string[] = []
  let buf = ''
  let inQuote = false
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i]
    buf += ch
    if (ch === '"' || ch === '“' || ch === '”') inQuote = !inQuote
    if (!inQuote && (ch === '.' || ch === '!' || ch === '?')) {
      const next = cleaned[i + 1]
      if (next === undefined || next === ' ') {
        const sentence = buf.trim()
        if (sentence.length > 0 && !sentence.startsWith('#')) parts.push(sentence)
        buf = ''
      }
    }
  }
  const tail = buf.trim()
  if (tail.length > 0 && !tail.startsWith('#')) parts.push(tail)
  return parts
}

const quotesIn = (sentence: string): string[] => {
  const found: string[] = []
  const re = new RegExp(QUOTE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(sentence))) {
    const quote = match[1] ?? match[2]
    if (quote) found.push(quote.trim())
  }
  return found
}

const chunkHasQuote = (chunk: string, quote: string): boolean => {
  const hay = chunk.toLowerCase().replace(/\s+/g, ' ')
  const needle = quote.toLowerCase().replace(/\s+/g, ' ')
  return needle.length >= 8 && hay.includes(needle)
}

export const attributeSentences = (
  text: string,
  section: string,
  sources: NumberedSource[]
): SentenceAttribution[] => {
  const bySid = new Map(sources.map((source) => [source.sid, source]))
  const allowed = new Set(sources.map((source) => source.sid))

  return splitSentences(text).map((sentence) => {
    const sids = citedSids(sentence, allowed)
    const quoteSpans: QuoteSpan[] = []
    for (const quote of quotesIn(sentence)) {
      for (const source of sources) {
        if (!chunkHasQuote(source.chunk_text, quote)) continue
        quoteSpans.push({ sid: source.sid, quote })
        if (!sids.includes(source.sid)) sids.push(source.sid)
      }
    }
    const uniqueSids = [...new Set(sids)]
    const vectorIds = uniqueSids
      .map((sid) => bySid.get(sid)?.vector_id)
      .filter((id): id is string => Boolean(id))
    const fileIds = [
      ...new Set(
        uniqueSids
          .map((sid) => bySid.get(sid)?.file_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    return {
      sentence,
      section,
      citedSids: uniqueSids,
      vectorIds,
      fileIds,
      quoteSpans,
      uncited: uniqueSids.length === 0,
    }
  })
}

export const uncitedSentences = (rows: SentenceAttribution[]): SentenceAttribution[] =>
  rows.filter((row) => row.uncited)
