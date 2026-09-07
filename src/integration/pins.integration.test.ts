import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import { PaperType } from '../types'
import { createDraftPaper } from '../lib/papers'
import { loadPins, pinPassage, unpinPassage } from '../lib/pins'
import { assertSupabaseUp, createConfirmedUser, deleteUser } from './supabaseTest'

const insertOwnedChunk = async (
  client: SupabaseClient,
  userId: string,
  fileName: string,
  chunkText: string
) => {
  const fileId = randomUUID()
  const { error: refError } = await client.from('references').insert({
    file_id: fileId,
    user_id: userId,
    document_type: 'reference',
    file_name: fileName,
    file_size: chunkText.length,
    source_role: 'primary',
  })
  expect(refError).toBeNull()
  const { data, error: vecError } = await client
    .from('reference_vectors')
    .insert({
      file_id: fileId,
      vector: hashEmbedding(chunkText),
      chunk_text: chunkText,
      chunk_index: 0,
      section: chunkText,
      embedding_model: 'hash-384',
    })
    .select('vector_id')
    .single()
  expect(vecError).toBeNull()
  return { fileId, vectorId: data!.vector_id as string }
}

describe('pins integration (PIN-1)', () => {
  beforeAll(assertSupabaseUp)

  it('should pin, list, and unpin own chunks for the current paper', async () => {
    const owner = await createConfirmedUser('pin-own')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Pin paper',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const chunk = await insertOwnedChunk(owner.client, owner.id, 'methods.txt', 'We measured overlap.')
      const pinned = await pinPassage(owner.client, owner.id, {
        paperId: paper.paper_id,
        fileId: chunk.fileId,
        vectorId: chunk.vectorId,
        targetSection: 'Methods',
      })
      expect(pinned.vector_id).toBe(chunk.vectorId)
      expect(pinned.target_section).toBe('Methods')

      const listed = await loadPins(owner.client, paper.paper_id)
      expect(listed).toHaveLength(1)
      expect(listed[0].file_name).toBe('methods.txt')
      expect(listed[0].chunk_text).toBe('We measured overlap.')
      expect(listed[0].source_role).toBe('primary')

      await unpinPassage(owner.client, pinned.pin_id)
      expect(await loadPins(owner.client, paper.paper_id)).toEqual([])

      const unscoped = await pinPassage(owner.client, owner.id, {
        paperId: paper.paper_id,
        fileId: chunk.fileId,
        vectorId: chunk.vectorId,
        targetSection: null,
      })
      expect(unscoped.target_section).toBeNull()
      const listedUnscoped = await loadPins(owner.client, paper.paper_id)
      expect(listedUnscoped).toHaveLength(1)
      expect(listedUnscoped[0].target_section).toBeNull()
      await unpinPassage(owner.client, unscoped.pin_id)
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
    }
  })

  it('should hide pins from another user and reject pinning their chunk', async () => {
    const owner = await createConfirmedUser('pin-rls-a')
    const other = await createConfirmedUser('pin-rls-b')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Secret pins',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const otherPaper = await createDraftPaper(other.client, other.id, {
        title: 'Other paper',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const ownerChunk = await insertOwnedChunk(owner.client, owner.id, 'owned.txt', 'owned chunk')
      const otherChunk = await insertOwnedChunk(other.client, other.id, 'other.txt', 'other chunk')

      const pinned = await pinPassage(owner.client, owner.id, {
        paperId: paper.paper_id,
        fileId: ownerChunk.fileId,
        vectorId: ownerChunk.vectorId,
      })

      const { data: asOther } = await other.client
        .from('pinned_passages')
        .select('pin_id')
        .eq('pin_id', pinned.pin_id)
      expect(asOther).toEqual([])

      const { error: stealPaper } = await other.client.from('pinned_passages').insert({
        user_id: other.id,
        paper_id: paper.paper_id,
        file_id: otherChunk.fileId,
        vector_id: otherChunk.vectorId,
      })
      expect(stealPaper).toBeTruthy()

      await expect(
        pinPassage(other.client, other.id, {
          paperId: otherPaper.paper_id,
          fileId: ownerChunk.fileId,
          vectorId: ownerChunk.vectorId,
        })
      ).rejects.toThrow(/own reference chunks/i)

      const { error: spoofOwner } = await other.client.from('pinned_passages').insert({
        user_id: owner.id,
        paper_id: paper.paper_id,
        file_id: ownerChunk.fileId,
        vector_id: ownerChunk.vectorId,
      })
      expect(spoofOwner).toBeTruthy()
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await other.client.from('user_papers').delete().eq('user_id', other.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await other.client.from('references').delete().eq('user_id', other.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should reject example-paper chunks and invalid target sections', async () => {
    const owner = await createConfirmedUser('pin-check')
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Checks',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const exampleId = randomUUID()
      expect(
        (
          await owner.client.from('examples').insert({
            file_id: exampleId,
            user_id: owner.id,
            document_type: 'example',
            file_name: 'style.txt',
            file_size: 12,
          })
        ).error
      ).toBeNull()
      const { data: exampleVec, error: exVecError } = await owner.client
        .from('example_vectors')
        .insert({
          file_id: exampleId,
          vector: hashEmbedding('style only'),
          chunk_text: 'style only',
          chunk_index: 0,
          section: 'style only',
          embedding_model: 'hash-384',
        })
        .select('vector_id')
        .single()
      expect(exVecError).toBeNull()

      await expect(
        pinPassage(owner.client, owner.id, {
          paperId: paper.paper_id,
          fileId: exampleId,
          vectorId: exampleVec!.vector_id as string,
        })
      ).rejects.toThrow(/own reference chunks/i)

      const chunk = await insertOwnedChunk(owner.client, owner.id, 'ok.txt', 'ok chunk')
      await expect(
        pinPassage(owner.client, owner.id, {
          paperId: paper.paper_id,
          fileId: chunk.fileId,
          vectorId: chunk.vectorId,
          targetSection: 'Appendix',
        })
      ).rejects.toThrow(/Invalid pin target section/)

      const { error: checkError } = await owner.client.from('pinned_passages').insert({
        user_id: owner.id,
        paper_id: paper.paper_id,
        file_id: chunk.fileId,
        vector_id: chunk.vectorId,
        target_section: 'Appendix',
      })
      expect(checkError?.code).toBe('23514')
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await owner.client.from('examples').delete().eq('user_id', owner.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
    }
  })
})
