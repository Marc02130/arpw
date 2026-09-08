import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import { NFR7_PROBE } from '../lib/nfr7Fixture'
import {
  INTERROGATION_TURNS_TABLE,
  loadInterrogationTurns,
  saveInterrogationExchange,
} from '../lib/interrogationNotes'
import { createDraftPaper } from '../lib/papers'
import { PaperType } from '../types'
import { assertSupabaseUp, createConfirmedUser, deleteUser } from './supabaseTest'

describe('interrogation notes integration (INT-3)', () => {
  beforeAll(assertSupabaseUp)

  it('should save and reload a thread and hide it from another user', async () => {
    const owner = await createConfirmedUser('notes-a')
    const other = await createConfirmedUser('notes-b')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Notes paper',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const saved = await saveInterrogationExchange(owner.client, owner.id, paper.paper_id, {
        question: 'What methods were used?',
        answer: 'They measured overlap [S1].',
        filterRole: 'primary',
        passages: [
          {
            vector_id: randomUUID(),
            file_id: randomUUID(),
            chunk_text: 'this study methods used nfr7probe',
            section: 'methods',
            page: null,
            source_role: 'primary',
            score: 0.9,
            paperSection: 'Interrogate',
            sid: 'S1',
          },
        ],
      })
      expect(saved.map((turn) => turn.role)).toEqual(['user', 'assistant'])
      expect(saved[1].passages[0].sid).toBe('S1')

      const loaded = await loadInterrogationTurns(owner.client, paper.paper_id)
      expect(loaded).toHaveLength(2)
      expect(loaded[0].content).toBe('What methods were used?')
      expect(loaded[1].content).toContain('[S1]')

      const { data: asOther } = await other.client
        .from(INTERROGATION_TURNS_TABLE)
        .select('turn_id')
        .eq('paper_id', paper.paper_id)
      expect(asOther).toEqual([])
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should not return chat notes from match_reference_chunks', async () => {
    const owner = await createConfirmedUser('notes-retrieve')
    const unique = `chat-note-${randomUUID()}`
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Notes not evidence',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      await saveInterrogationExchange(owner.client, owner.id, paper.paper_id, {
        question: `${NFR7_PROBE} ${unique}`,
        answer: `Invented methods ${unique}`,
        filterRole: 'both',
        passages: [],
      })
      const { data, error } = await owner.client.rpc('match_reference_chunks', {
        query_embedding: hashEmbedding(`${NFR7_PROBE} ${unique}`),
        match_count: 8,
        filter_role: 'both',
      })
      expect(error).toBeNull()
      expect(data?.some((row: { chunk_text: string }) => row.chunk_text.includes(unique))).toBe(
        false
      )
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
    }
  })
})
