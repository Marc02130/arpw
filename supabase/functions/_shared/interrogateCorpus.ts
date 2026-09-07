import {
  allowedSidSet,
  citedSids,
  formatSourcesForPrompt,
  numberSources,
  stripUnknownCitations,
  type NumberedSource,
} from './citations.ts'
import { parsePaperId } from './saveGeneratedDraft.ts'
import {
  parseInterrogateFilter,
  type InterrogateFilter,
  type RetrievedPassage,
} from './retrievePassages.ts'

export type InterrogateRequest = {
  paperId: string
  question: string
  filterRole: InterrogateFilter
}

export type InterrogatePassage = RetrievedPassage & { sid: string }

export const NO_INTERROGATE_MATCH_MESSAGE =
  'No passages matched. Upload and index literature or original research on the Upload tab.'

export const buildInterrogatePrompt = (question: string, sourceBlock: string): string =>
  `You are helping a researcher inspect their own uploaded corpus. Answer the question using only the retrieved sources. Cite with [S#] ids exactly as given. Do not invent ids. If the sources do not support an answer, say so and include no [S#] citations.

Question:
${question}

Retrieved sources (cite only these ids, like [S1]):
${sourceBlock}`

export const parseInterrogateRequest = (body: unknown): InterrogateRequest => {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid interrogate request')
  }
  const rec = body as Record<string, unknown>
  const paperId = parsePaperId(rec.paperId)
  if (!paperId) {
    throw new Error('Start or continue a paper from the Dashboard first')
  }
  const question = typeof rec.question === 'string' ? rec.question.trim() : ''
  if (!question) {
    throw new Error('Enter a question')
  }
  if (question.length > 8000) {
    throw new Error('Question is too long')
  }
  return {
    paperId,
    question,
    filterRole: parseInterrogateFilter(rec.filterRole ?? rec.sourceRole),
  }
}

export const attachSids = (passages: RetrievedPassage[], sources: NumberedSource[]): InterrogatePassage[] => {
  const sidByVector = new Map(sources.map((source) => [source.vector_id, source.sid]))
  return passages.map((passage) => ({
    ...passage,
    sid: sidByVector.get(passage.vector_id) ?? '',
  }))
}

export const interrogateCorpus = async (opts: {
  question: string
  passages: RetrievedPassage[]
  complete: (prompt: string) => Promise<string>
}): Promise<{
  answer: string
  passages: InterrogatePassage[]
  citedSids: string[]
  sources: NumberedSource[]
}> => {
  const sources = numberSources(opts.passages)
  const numbered = attachSids(opts.passages, sources)
  if (sources.length === 0) {
    return {
      answer: NO_INTERROGATE_MATCH_MESSAGE,
      passages: [],
      citedSids: [],
      sources: [],
    }
  }
  const allowed = allowedSidSet(sources)
  const raw = await opts.complete(buildInterrogatePrompt(opts.question, formatSourcesForPrompt(sources)))
  const answer = stripUnknownCitations(raw, allowed)
  return {
    answer,
    passages: numbered,
    citedSids: citedSids(answer, allowed),
    sources,
  }
}
