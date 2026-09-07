import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { PaperType, Status } from '../types'
import {
  createDraftPaper,
  listPapers,
  loadPaper,
  saveGeneratedDraft,
  updatePaperConfig,
} from '../lib/papers'
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

      await updatePaperConfig(owner.client, paper.paper_id, {
        title: 'Citation overlap v2',
        research_prompt: 'nfr7probe citation overlap',
      })
      const reloaded = await loadPaper(owner.client, paper.paper_id)
      expect(reloaded.title).toBe('Citation overlap v2')
      expect(reloaded.research_prompt).toBe('nfr7probe citation overlap')
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should save generated content and only owned cited files (slice 5)', async () => {
    const owner = await createConfirmedUser('paper-save-a')
    const other = await createConfirmedUser('paper-save-b')
    const ownedId = randomUUID()
    const otherId = randomUUID()
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Citation overlap',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      expect(
        (
          await owner.client.from('references').insert({
            file_id: ownedId,
            user_id: owner.id,
            document_type: 'reference',
            file_name: 'methods.txt',
            file_size: 20,
            source_role: 'primary',
          })
        ).error
      ).toBeNull()
      expect(
        (
          await other.client.from('references').insert({
            file_id: otherId,
            user_id: other.id,
            document_type: 'reference',
            file_name: 'other.txt',
            file_size: 12,
          })
        ).error
      ).toBeNull()

      const saved = await saveGeneratedDraft(owner.client, {
        paperId: paper.paper_id,
        content: '## Methods\n\nWe measured overlap [S1].',
        sections: ['Methods'],
        paperType: PaperType.EMPIRICAL_STUDY,
        citationStyle: 'APA',
        outputFormat: 'markdown',
        citedFileIds: [ownedId, otherId, randomUUID()],
      })
      expect(saved.status).toBe('completed')
      expect(saved.citedFileIds).toEqual([ownedId])

      const reloaded = await loadPaper(owner.client, paper.paper_id)
      expect(reloaded.status).toBe(Status.COMPLETED)
      expect(reloaded.content).toContain('[S1]')
      expect(reloaded.sections).toEqual(['Methods'])

      const { data: links } = await owner.client
        .from('paper_references')
        .select('file_id')
        .eq('paper_id', paper.paper_id)
      expect(links?.map((row) => row.file_id)).toEqual([ownedId])

      const { data: asOther } = await other.client
        .from('paper_references')
        .select('file_id')
        .eq('paper_id', paper.paper_id)
      expect(asOther).toEqual([])

      await expect(
        saveGeneratedDraft(other.client, {
          paperId: paper.paper_id,
          content: 'stolen',
          sections: ['Methods'],
          paperType: PaperType.EMPIRICAL_STUDY,
          citedFileIds: [ownedId],
        })
      ).rejects.toThrow(/not found/i)
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await other.client.from('references').delete().eq('user_id', other.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })
})
