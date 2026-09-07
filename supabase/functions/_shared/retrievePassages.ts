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
  source_role: string
  score: number
  paperSection: string
}

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
  matchCount: number
): Promise<RetrievedPassage[]> => {
  const { data, error } = await client.rpc('match_reference_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
    filter_role: filterRole,
  })
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    vector_id: String(row.vector_id),
    file_id: String(row.file_id),
    chunk_text: String(row.chunk_text ?? ''),
    section: row.section == null ? null : String(row.section),
    source_role: String(row.source_role ?? ''),
    score: typeof row.score === 'number' ? row.score : Number(row.score),
    paperSection: '',
  }))
}

export const retrieveForSection = async (
  client: SupabaseClient,
  paperType: string,
  section: string,
  researchPrompt: string,
  matchCount = DEFAULT_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const template = getSectionTemplate(paperType, section)
  const attempts = retrievalAttempts(template.preferredSourceRole)
  if (attempts.length === 0) return []

  const embedding = hashEmbedding(buildRetrievalQuery(paperType, section, researchPrompt))

  for (const filterRole of attempts) {
    const rows = await matchChunks(client, embedding, filterRole, matchCount)
    if (rows.length > 0) {
      return rows.map((row) => ({ ...row, paperSection: section }))
    }
  }
  return []
}

export const retrieveForPaper = async (
  client: SupabaseClient,
  paperType: string,
  sections: string[],
  researchPrompt: string,
  matchCount = DEFAULT_MATCH_COUNT
): Promise<RetrievedPassage[]> => {
  const topic = researchPrompt.trim()
  if (!topic) {
    throw new Error('Enter a research prompt')
  }

  const out: RetrievedPassage[] = []
  for (const section of sections) {
    const rows = await retrieveForSection(client, paperType, section, topic, matchCount)
    out.push(...rows)
  }
  return out
}
