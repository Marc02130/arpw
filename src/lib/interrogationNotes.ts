import type { SupabaseClient } from '@supabase/supabase-js'
import type { InterrogatePassage } from './interrogateCorpus'
import { parseInterrogateFilter, type InterrogateFilter } from './retrievePassages'

export const INTERROGATION_TURNS_TABLE = 'interrogation_turns'

export type InterrogationRole = 'user' | 'assistant'

export type InterrogationTurn = {
  turn_id: string
  paper_id: string
  role: InterrogationRole
  content: string
  filter_role: InterrogateFilter | null
  passages: InterrogatePassage[]
  created_at: string
}

export const parseInterrogationRole = (value: unknown): InterrogationRole => {
  if (value === 'user' || value === 'assistant') return value
  throw new Error('Invalid interrogation turn role')
}

export const parseStoredPassages = (value: unknown): InterrogatePassage[] => {
  if (!Array.isArray(value)) return []
  const out: InterrogatePassage[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    if (typeof rec.vector_id !== 'string' || typeof rec.file_id !== 'string') continue
    out.push({
      vector_id: rec.vector_id,
      file_id: rec.file_id,
      chunk_text: typeof rec.chunk_text === 'string' ? rec.chunk_text : '',
      section: rec.section == null ? null : String(rec.section),
      page: typeof rec.page === 'number' && rec.page >= 1 ? rec.page : null,
      source_role: typeof rec.source_role === 'string' ? rec.source_role : 'literature',
      score: typeof rec.score === 'number' ? rec.score : Number(rec.score) || 0,
      paperSection: typeof rec.paperSection === 'string' ? rec.paperSection : 'Interrogate',
      sid: typeof rec.sid === 'string' ? rec.sid : '',
      pinned: rec.pinned === true,
    })
  }
  return out
}

const mapRow = (row: Record<string, unknown>): InterrogationTurn => ({
  turn_id: String(row.turn_id),
  paper_id: String(row.paper_id),
  role: parseInterrogationRole(row.role),
  content: String(row.content ?? ''),
  filter_role:
    row.filter_role == null || row.filter_role === ''
      ? null
      : parseInterrogateFilter(row.filter_role),
  passages: parseStoredPassages(row.passages),
  created_at: String(row.created_at ?? ''),
})

export const loadInterrogationTurns = async (
  client: SupabaseClient,
  paperId: string
): Promise<InterrogationTurn[]> => {
  const { data, error } = await client
    .from(INTERROGATION_TURNS_TABLE)
    .select('turn_id, paper_id, role, content, filter_role, passages, created_at')
    .eq('paper_id', paperId)
    .order('created_at', { ascending: true })
    .order('turn_id', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export const saveInterrogationExchange = async (
  client: SupabaseClient,
  userId: string,
  paperId: string,
  input: {
    question: string
    answer: string
    filterRole: InterrogateFilter
    passages: InterrogatePassage[]
  }
): Promise<InterrogationTurn[]> => {
  const question = input.question.trim()
  const answer = input.answer.trim()
  if (!question) throw new Error('Enter a question')
  if (!answer) throw new Error('Interrogation failed')
  const insertTurn = async (role: InterrogationRole, content: string, passages: InterrogatePassage[]) => {
    const { data, error } = await client
      .from(INTERROGATION_TURNS_TABLE)
      .insert({
        user_id: userId,
        paper_id: paperId,
        role,
        content,
        filter_role: input.filterRole,
        passages,
      })
      .select('turn_id, paper_id, role, content, filter_role, passages, created_at')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Could not save interrogation notes')
    return mapRow(data as Record<string, unknown>)
  }
  const userTurn = await insertTurn('user', question, [])
  const assistantTurn = await insertTurn('assistant', answer, input.passages)
  return [userTurn, assistantTurn]
}
