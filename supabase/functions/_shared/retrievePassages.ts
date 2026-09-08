import type { SupabaseClient } from '@supabase/supabase-js'
import { hashEmbedding } from '../upload_processor/ingest.ts'
import {
  type RetrievalRole,
  buildRetrievalQuery,
  getSectionTemplate,
} from './generationTemplates.ts'

export const DEFAULT_MATCH_COUNT = 12

export type RetrievedPassage = {
  vector_id: string
  file_id: string
  chunk_text: string
  section: string | null
  page: number | null
  source_role: string
  score: number
  paperSection: string
  pinned?: boolean
}

export type EvidencePin = RetrievedPassage & { target_section: string | null }

export type RetrieveOptions = {
  matchCount?: number
  paperId?: string
  pins?: EvidencePin[]
}

export const PINNED_SCORE = 1

export const parseChunkPage = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const page = Number(value)
    return page >= 1 ? page : null
  }
  return null
}

export const isEvidenceRole = (role: string): boolean =>
  role === 'literature' || role === 'primary'

export const filterPinsForSection = (
  pins: EvidencePin[],
  section: string,
  paperType: string
): RetrievedPassage[] => {
  if (section === 'References') return []
  const literatureReview = paperType === 'Literature Review'
  return pins
    .filter((pin) => {
      if (!isEvidenceRole(pin.source_role)) return false
      if (literatureReview && pin.source_role === 'primary') return false
      return pin.target_section == null || pin.target_section === section
    })
    .map((pin) => ({
      vector_id: pin.vector_id,
      file_id: pin.file_id,
      chunk_text: pin.chunk_text,
      section: pin.section,
      page: pin.page ?? null,
      source_role: pin.source_role,
      score: PINNED_SCORE,
      paperSection: section,
      pinned: true,
    }))
}

/** Prefer chunks whose stored section matches the paper section; keep cosine order within each group. */
export const preferMatchingSection = <T extends { section: string | null }>(
  rows: T[],
  section: string
): T[] => {
  const wanted = section.trim().toLowerCase()
  if (!wanted || wanted === 'references') return rows
  const preferred: T[] = []
  const rest: T[] = []
  for (const row of rows) {
    if ((row.section ?? '').trim().toLowerCase() === wanted) preferred.push(row)
    else rest.push(row)
  }
  if (preferred.length === 0) return rows
  return [...preferred, ...rest]
}

export const mergePinnedFirst = (
  pinned: RetrievedPassage[],
  retrieved: RetrievedPassage[]
): RetrievedPassage[] => {
  const seen = new Set<string>()
  const out: RetrievedPassage[] = []
  for (const row of [...pinned, ...retrieved]) {
    if (!row.vector_id || seen.has(row.vector_id)) continue
    if (row.source_role === 'example') continue
    seen.add(row.vector_id)
    out.push(row)
  }
  return out
}

const uniqueByVector = (rows: RetrievedPassage[]): RetrievedPassage[] => {
  const seen = new Set<string>()
  const out: RetrievedPassage[] = []
  for (const row of rows) {
    if (seen.has(row.vector_id)) continue
    seen.add(row.vector_id)
    out.push(row)
  }
  return out
}

const normalizeRetrieveOptions = (opts?: number | RetrieveOptions): RetrieveOptions =>
  typeof opts === 'number' ? { matchCount: opts } : (opts ?? {})

/** Abstract/Intro: literature plus primary when this is not a literature-review paper. */
export const unionPrimaryForSection = (paperType: string, section: string): boolean =>
  paperType !== 'Literature Review' && (section === 'Abstract' || section === 'Introduction')

export const retrievalAttempts = (
  preferred: RetrievalRole
): Array<'literature' | 'primary' | 'both'> => {
  if (preferred === 'none') return []
  if (preferred === 'primary') return ['primary', 'literature']
  if (preferred === 'literature') return ['literature']
  return ['both']
}

const matchChunks = async (
  client: SupabaseClient,
  embedding: number[],
  filterRole: 'literature' | 'primary' | 'both',
  matchCount: number,
  preferSection?: string | null
): Promise<RetrievedPassage[]> => {
  const { data, error } = await client.rpc('match_reference_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
    filter_role: filterRole,
    prefer_section: preferSection?.trim() ? preferSection.trim() : null,
  })
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    vector_id: String(row.vector_id),
    file_id: String(row.file_id),
    chunk_text: String(row.chunk_text ?? ''),
    section: row.section == null ? null : String(row.section),
    page: parseChunkPage(row.page),
    source_role: String(row.source_role ?? ''),
    score: typeof row.score === 'number' ? row.score : Number(row.score),
    paperSection: '',
  }))
}

export const loadEvidencePins = async (
  client: SupabaseClient,
  paperId: string
): Promise<EvidencePin[]> => {
  const { data, error } = await client
    .from('pinned_passages')
    .select('file_id, vector_id, target_section')
    .eq('paper_id', paperId)
  if (error) throw new Error(error.message)
  const pins = data ?? []
  if (pins.length === 0) return []

  const vectorIds = [...new Set(pins.map((pin) => String(pin.vector_id)))]
  const fileIds = [...new Set(pins.map((pin) => String(pin.file_id)))]
  const [chunks, files] = await Promise.all([
    client.from('reference_vectors').select('vector_id, file_id, chunk_text, section, page').in('vector_id', vectorIds),
    client.from('references').select('file_id, source_role').in('file_id', fileIds),
  ])
  if (chunks.error) throw new Error(chunks.error.message)
  if (files.error) throw new Error(files.error.message)
  const chunkById = new Map(
    (chunks.data ?? []).map((row) => [String(row.vector_id), row])
  )
  const fileById = new Map(
    (files.data ?? []).map((row) => [String(row.file_id), row])
  )

  const out: EvidencePin[] = []
  for (const pin of pins) {
    const chunk = chunkById.get(String(pin.vector_id))
    const file = fileById.get(String(pin.file_id))
    const sourceRole = String(file?.source_role ?? '')
    if (!chunk || !isEvidenceRole(sourceRole)) continue
    out.push({
      vector_id: String(pin.vector_id),
      file_id: String(pin.file_id),
      chunk_text: String(chunk.chunk_text ?? ''),
      section: chunk.section == null ? null : String(chunk.section),
      page: parseChunkPage(chunk.page),
      source_role: sourceRole,
      score: PINNED_SCORE,
      paperSection: '',
      pinned: true,
      target_section: pin.target_section == null ? null : String(pin.target_section),
    })
  }
  return out
}

export const retrieveForSection = async (
  client: SupabaseClient,
  paperType: string,
  section: string,
  researchPrompt: string,
  matchCountOrOpts: number | RetrieveOptions = DEFAULT_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const opts = normalizeRetrieveOptions(matchCountOrOpts)
  const matchCount = opts.matchCount ?? DEFAULT_MATCH_COUNT
  const pins = opts.pins ?? (opts.paperId ? await loadEvidencePins(client, opts.paperId) : [])
  const pinned = filterPinsForSection(pins, section, paperType)

  const template = getSectionTemplate(paperType, section)
  const attempts = retrievalAttempts(template.preferredSourceRole)
  if (attempts.length === 0) return []

  const embedding = hashEmbedding(buildRetrievalQuery(paperType, section, researchPrompt))
  const withSection = (rows: RetrievedPassage[]): RetrievedPassage[] =>
    rows.map((row) => ({ ...row, paperSection: section }))

  if (template.preferredSourceRole === 'both' || unionPrimaryForSection(paperType, section)) {
    const roles: Array<'literature' | 'primary' | 'both'> =
      template.preferredSourceRole === 'both' ? ['both'] : ['literature', 'primary']
    const batches = await Promise.all(
      roles.map((role) => matchChunks(client, embedding, role, matchCount, section))
    )
    return mergePinnedFirst(
      pinned,
      preferMatchingSection(uniqueByVector(withSection(batches.flat())), section)
    )
  }

  for (const filterRole of attempts) {
    const rows = await matchChunks(client, embedding, filterRole, matchCount, section)
    if (rows.length > 0) {
      return mergePinnedFirst(pinned, preferMatchingSection(withSection(rows), section))
    }
  }
  return pinned
}

export const DEFAULT_EXAMPLE_MATCH_COUNT = 4

export const retrieveExamplePassages = async (
  client: SupabaseClient,
  paperType: string,
  section: string,
  researchPrompt: string,
  matchCount = DEFAULT_EXAMPLE_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const template = getSectionTemplate(paperType, section)
  if (template.preferredSourceRole === 'none') return []
  const embedding = hashEmbedding(buildRetrievalQuery(paperType, section, researchPrompt))
  const { data, error } = await client.rpc('match_example_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
    prefer_section: section,
  })
  if (error) {
    throw new Error(error.message)
  }
  return preferMatchingSection(
    (data ?? []).map((row: Record<string, unknown>) => ({
      vector_id: String(row.vector_id),
      file_id: String(row.file_id),
      chunk_text: String(row.chunk_text ?? ''),
      section: row.section == null ? null : String(row.section),
      page: parseChunkPage(row.page),
      source_role: 'example',
      score: typeof row.score === 'number' ? row.score : Number(row.score),
      paperSection: section,
    })),
    section
  )
}

export const formatStyleForPrompt = (passages: RetrievedPassage[]): string => {
  if (passages.length === 0) return ''
  const body = passages.map((passage) => passage.chunk_text).join('\n\n')
  return `Voice and structure examples (style only — do not cite these as evidence, and do not invent [S#] ids for them):\n${body}`
}

export type InterrogateFilter = 'literature' | 'primary' | 'both'

export const parseInterrogateFilter = (value: unknown): InterrogateFilter => {
  if (value === 'literature' || value === 'primary' || value === 'both') return value
  return 'both'
}

export const retrieveForQuestion = async (
  client: SupabaseClient,
  question: string,
  filterRole: InterrogateFilter,
  matchCount = DEFAULT_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const topic = question.trim()
  if (!topic) {
    throw new Error('Enter a question')
  }
  const rows = await matchChunks(client, hashEmbedding(topic), filterRole, matchCount)
  return rows.map((row) => ({ ...row, paperSection: 'Interrogate' }))
}

export const retrieveForPaper = async (
  client: SupabaseClient,
  paperType: string,
  sections: string[],
  researchPrompt: string,
  matchCountOrOpts: number | RetrieveOptions = DEFAULT_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const topic = researchPrompt.trim()
  if (!topic) {
    throw new Error('Enter a research prompt')
  }
  const opts = normalizeRetrieveOptions(matchCountOrOpts)
  const pins = opts.pins ?? (opts.paperId ? await loadEvidencePins(client, opts.paperId) : [])
  const matchCount = opts.matchCount ?? DEFAULT_MATCH_COUNT

  const out: RetrievedPassage[] = []
  for (const section of sections) {
    const rows = await retrieveForSection(client, paperType, section, topic, {
      matchCount,
      pins,
    })
    out.push(...rows)
  }
  return out
}

export const retrieveExamplesForPaper = async (
  client: SupabaseClient,
  paperType: string,
  sections: string[],
  researchPrompt: string,
  matchCount = DEFAULT_EXAMPLE_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const topic = researchPrompt.trim()
  if (!topic) {
    throw new Error('Enter a research prompt')
  }
  const out: RetrievedPassage[] = []
  const seen = new Set<string>()
  for (const section of sections) {
    const rows = await retrieveExamplePassages(client, paperType, section, topic, matchCount)
    for (const row of rows) {
      if (seen.has(row.vector_id)) continue
      seen.add(row.vector_id)
      out.push(row)
    }
  }
  return out
}
