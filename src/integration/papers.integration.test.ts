import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import { PaperType, Status } from '../types'
import {
  createDraftPaper,
  createRegenerateDraft,
  deletePaper,
  listPapers,
  loadPaper,
  saveGeneratedDraft,
  updatePaperConfig,
} from '../lib/papers'
import { saveInterrogationExchange } from '../lib/interrogationNotes'
import { pinPassage } from '../lib/pins'
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
      expect(reloaded.paper_type).toBe(PaperType.EMPIRICAL_STUDY)

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

  it('should keep Literature Review when generate saves a draft', async () => {
    const owner = await createConfirmedUser('paper-type-keep')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Gut-brain axis',
        paperType: PaperType.LITERATURE_REVIEW,
      })
      await saveGeneratedDraft(owner.client, {
        paperId: paper.paper_id,
        content: '## Literature Review\n\nOmega-3 [S1].',
        sections: ['Literature Review'],
        paperType: PaperType.EMPIRICAL_STUDY,
        citedFileIds: [],
      })
      const reloaded = await loadPaper(owner.client, paper.paper_id)
      expect(reloaded.paper_type).toBe(PaperType.LITERATURE_REVIEW)
      expect(reloaded.status).toBe(Status.COMPLETED)
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
    }
  })

  it('should insert the next version row when regenerating (LIB-2/3)', async () => {
    const owner = await createConfirmedUser('paper-regen')
    try {
      const first = await createDraftPaper(owner.client, owner.id, {
        title: 'Citation overlap',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      await updatePaperConfig(owner.client, first.paper_id, {
        research_prompt: 'nfr7probe citation overlap',
        sections: ['Methods', 'Results'],
      })
      const source = await loadPaper(owner.client, first.paper_id)
      const next = await createRegenerateDraft(owner.client, owner.id, source)
      expect(next.paper_id).not.toBe(first.paper_id)
      expect(next.title).toBe('Citation overlap')
      expect(next.version).toBe(2)
      expect(next.status).toBe(Status.DRAFT)
      expect(next.research_prompt).toBe('nfr7probe citation overlap')
      expect(next.sections).toEqual(['Methods', 'Results'])
      expect(next.content).toBe('')
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
    }
  })

  it('should delete a paper and cascade pins and notes (LIB-3)', async () => {
    const owner = await createConfirmedUser('paper-del')
    const other = await createConfirmedUser('paper-del-other')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Delete me',
        paperType: PaperType.LITERATURE_REVIEW,
      })
      const otherPaper = await createDraftPaper(other.client, other.id, {
        title: 'Keep me',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const fileId = randomUUID()
      expect(
        (
          await owner.client.from('references').insert({
            file_id: fileId,
            user_id: owner.id,
            document_type: 'reference',
            file_name: 'methods.txt',
            file_size: 20,
            source_role: 'literature',
          })
        ).error
      ).toBeNull()
      const { data: vector, error: vecError } = await owner.client
        .from('reference_vectors')
        .insert({
          file_id: fileId,
          vector: hashEmbedding('omega-3 cognition'),
          chunk_text: 'omega-3 cognition',
          chunk_index: 0,
          section: 'Discussion',
          embedding_model: 'hash-384',
        })
        .select('vector_id')
        .single()
      expect(vecError).toBeNull()
      await pinPassage(owner.client, owner.id, {
        paperId: paper.paper_id,
        fileId,
        vectorId: vector!.vector_id as string,
        targetSection: 'Literature Review',
      })
      await saveInterrogationExchange(owner.client, owner.id, paper.paper_id, {
        question: 'What do these papers say about omega-3?',
        answer: 'They discuss cognition [S1].',
        filterRole: 'literature',
        passages: [],
      })

      await deletePaper(owner.client, paper.paper_id)

      expect(await listPapers(owner.client, owner.id)).toEqual([])
      const { data: pins } = await owner.client
        .from('pinned_passages')
        .select('pin_id')
        .eq('paper_id', paper.paper_id)
      expect(pins).toEqual([])
      const { data: turns } = await owner.client
        .from('interrogation_turns')
        .select('turn_id')
        .eq('paper_id', paper.paper_id)
      expect(turns).toEqual([])

      await expect(deletePaper(other.client, paper.paper_id)).rejects.toThrow(/not found/i)
      const otherListed = await listPapers(other.client, other.id)
      expect(otherListed.map((row) => row.paper_id)).toContain(otherPaper.paper_id)
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await other.client.from('user_papers').delete().eq('user_id', other.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })
})
