import { beforeAll, describe, expect, it } from 'vitest'
import { PaperType, Status } from '../types'
import { createDraftPaper, listPapers, loadPaper, updatePaperConfig } from '../lib/papers'
import { assertSupabaseUp, createConfirmedUser, deleteUser } from './supabaseTest'

describe('papers integration (dashboard workspace)', () => {
  beforeAll(assertSupabaseUp)

  it('should create a draft, list it, and hide it from another user', async () => {
    const owner = await createConfirmedUser('paper-a')
    const other = await createConfirmedUser('paper-b')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: '  Citation overlap  ',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      expect(paper.title).toBe('Citation overlap')
      expect(paper.status).toBe(Status.DRAFT)
      expect(paper.content).toBe('')

      const listed = await listPapers(owner.client, owner.id)
      expect(listed.map((row) => row.paper_id)).toContain(paper.paper_id)

      const asOther = await listPapers(other.client, other.id)
      expect(asOther).toEqual([])

      const { data: stolen } = await other.client
        .from('user_papers')
        .select('paper_id')
        .eq('paper_id', paper.paper_id)
      expect(stolen).toEqual([])

      await updatePaperConfig(owner.client, paper.paper_id, { title: 'Citation overlap v2' })
      const reloaded = await loadPaper(owner.client, paper.paper_id)
      expect(reloaded.title).toBe('Citation overlap v2')
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })
})
