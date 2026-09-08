import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import { NFR7_PROBE, NFR7_TEXT } from '../lib/nfr7Fixture'
import { pinPassage } from '../lib/pins'
import { createDraftPaper } from '../lib/papers'
import { retrieveForSection } from '../lib/retrievePassages'
import { PaperType } from '../types'
import { anonClient, assertSupabaseUp, createConfirmedUser, deleteUser } from './supabaseTest'

describe('retrieval integration (slice 3 / NFR-7)', () => {
  beforeAll(assertSupabaseUp)

  it('should return the fixture chunk for a query containing nfr7probe', async () => {
    const user = await createConfirmedUser('ret-nfr7')
    const fileId = randomUUID()
    try {
      const { error: insertError } = await user.client.from('references').insert({
        file_id: fileId,
        user_id: user.id,
        document_type: 'reference',
        file_name: 'nfr7-fixture.txt',
        file_size: NFR7_TEXT.length,
        source_role: 'literature',
      })
      expect(insertError).toBeNull()

      const { error: vecError } = await user.client.from('reference_vectors').insert({
        file_id: fileId,
        vector: hashEmbedding(NFR7_TEXT),
        chunk_text: NFR7_TEXT,
        chunk_index: 0,
        section: 'Methods',
        embedding_model: 'hash-384',
      })
      expect(vecError).toBeNull()

      const { data, error } = await user.client.rpc('match_reference_chunks', {
        query_embedding: hashEmbedding(`methods ${NFR7_PROBE} citation overlap`),
        match_count: 8,
        filter_role: 'literature',
      })
      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
      expect(data?.some((row: { chunk_text: string }) => row.chunk_text.includes(NFR7_PROBE))).toBe(
        true
      )
      expect(data?.[0]?.file_id).toBe(fileId)
    } finally {
      await user.client.from('references').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })

  it('should hide chunks from another user and honor source_role', async () => {
    const owner = await createConfirmedUser('ret-a')
    const other = await createConfirmedUser('ret-b')
    const litId = randomUUID()
    const primId = randomUUID()
    try {
      const { error: litErr } = await owner.client.from('references').insert({
        file_id: litId,
        user_id: owner.id,
        document_type: 'reference',
        file_name: 'lit.txt',
        file_size: 40,
        source_role: 'literature',
      })
      expect(litErr).toBeNull()
      const { error: primErr } = await owner.client.from('references').insert({
        file_id: primId,
        user_id: owner.id,
        document_type: 'reference',
        file_name: 'study.txt',
        file_size: 40,
        source_role: 'primary',
      })
      expect(primErr).toBeNull()

      const litText = 'published methods for measuring citation overlap in journals'
      const primText = 'this study methods used twelve participants and a citation overlap task'
      expect(
        (await owner.client.from('reference_vectors').insert([
          {
            file_id: litId,
            vector: hashEmbedding(litText),
            chunk_text: litText,
            chunk_index: 0,
            section: 'methods',
            embedding_model: 'hash-384',
          },
          {
            file_id: primId,
            vector: hashEmbedding(primText),
            chunk_text: primText,
            chunk_index: 0,
            section: 'methods',
            embedding_model: 'hash-384',
          },
        ])).error
      ).toBeNull()

      const { data: asOther } = await other.client.rpc('match_reference_chunks', {
        query_embedding: hashEmbedding(primText),
        match_count: 8,
        filter_role: 'both',
      })
      expect(asOther).toEqual([])

      const { error: anonError } = await anonClient().rpc('match_reference_chunks', {
        query_embedding: hashEmbedding(primText),
        match_count: 8,
        filter_role: 'both',
      })
      expect(anonError).toBeTruthy()

      const { data: literatureOnly } = await owner.client.rpc('match_reference_chunks', {
        query_embedding: hashEmbedding(litText),
        match_count: 8,
        filter_role: 'literature',
      })
      expect(literatureOnly?.every((row: { file_id: string }) => row.file_id === litId)).toBe(true)

      const methods = await retrieveForSection(
        owner.client,
        PaperType.EMPIRICAL_STUDY,
        'Methods',
        primText,
        8
      )
      expect(methods.length).toBeGreaterThan(0)
      expect(methods[0].file_id).toBe(primId)
      expect(methods[0].paperSection).toBe('Methods')
    } finally {
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
      await deleteUser(other.id)
    }
  })

  it('should put a pinned literature chunk ahead of primary methods retrieval', async () => {
    const owner = await createConfirmedUser('ret-pin')
    const litId = randomUUID()
    const primId = randomUUID()
    try {
      const paper = await createDraftPaper(owner.client, owner.id, {
        title: 'Pin first',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      expect(
        (
          await owner.client.from('references').insert([
            {
              file_id: litId,
              user_id: owner.id,
              document_type: 'reference',
              file_name: 'lit.txt',
              file_size: 40,
              source_role: 'literature',
            },
            {
              file_id: primId,
              user_id: owner.id,
              document_type: 'reference',
              file_name: 'study.txt',
              file_size: 40,
              source_role: 'primary',
            },
          ])
        ).error
      ).toBeNull()
      const litText = 'published citation overlap protocol from the literature'
      const primText = 'this study methods used twelve participants and a citation overlap task'
      const { data: vecs, error: vecError } = await owner.client
        .from('reference_vectors')
        .insert([
          {
            file_id: litId,
            vector: hashEmbedding(litText),
            chunk_text: litText,
            chunk_index: 0,
            section: 'methods',
            embedding_model: 'hash-384',
          },
          {
            file_id: primId,
            vector: hashEmbedding(primText),
            chunk_text: primText,
            chunk_index: 0,
            section: 'methods',
            embedding_model: 'hash-384',
          },
        ])
        .select('vector_id, file_id')
      expect(vecError).toBeNull()
      const litVec = vecs?.find((row) => row.file_id === litId)?.vector_id as string
      await pinPassage(owner.client, owner.id, {
        paperId: paper.paper_id,
        fileId: litId,
        vectorId: litVec,
        targetSection: 'Methods',
      })

      const methods = await retrieveForSection(
        owner.client,
        PaperType.EMPIRICAL_STUDY,
        'Methods',
        primText,
        { paperId: paper.paper_id, matchCount: 8 }
      )
      expect(methods[0]?.vector_id).toBe(litVec)
      expect(methods[0]?.pinned).toBe(true)
      expect(methods.some((row) => row.file_id === primId)).toBe(true)
    } finally {
      await owner.client.from('user_papers').delete().eq('user_id', owner.id)
      await owner.client.from('references').delete().eq('user_id', owner.id)
      await deleteUser(owner.id)
    }
  })

  it('should prefer Methods-labeled chunks over bibliography that shares query tokens', async () => {
    const user = await createConfirmedUser('ret-sec')
    const methodsId = randomUUID()
    const refsId = randomUUID()
    try {
      expect(
        (
          await user.client.from('references').insert([
            {
              file_id: methodsId,
              user_id: user.id,
              document_type: 'reference',
              file_name: 'study.txt',
              file_size: 80,
              source_role: 'literature',
            },
            {
              file_id: refsId,
              user_id: user.id,
              document_type: 'reference',
              file_name: 'refs.txt',
              file_size: 80,
              source_role: 'literature',
            },
          ])
        ).error
      ).toBeNull()

      const methodsText = 'this study used twelve participants and a citation overlap task'
      const refsText =
        'methods methods methods methods methods methods citation overlap Smith 2020 bibliography'
      expect(
        (
          await user.client.from('reference_vectors').insert([
            {
              file_id: methodsId,
              vector: hashEmbedding(methodsText),
              chunk_text: methodsText,
              chunk_index: 0,
              section: 'Methods',
              embedding_model: 'hash-384',
            },
            {
              file_id: refsId,
              vector: hashEmbedding(refsText),
              chunk_text: refsText,
              chunk_index: 0,
              section: 'References',
              embedding_model: 'hash-384',
            },
          ])
        ).error
      ).toBeNull()

      const query = hashEmbedding('methods methods methods methods bibliography Smith 2020')
      const { data: cosineFirst, error: cosineError } = await user.client.rpc('match_reference_chunks', {
        query_embedding: query,
        match_count: 8,
        filter_role: 'literature',
      })
      expect(cosineError).toBeNull()
      expect(cosineFirst?.[0]?.file_id).toBe(refsId)

      const { data: preferred, error: preferError } = await user.client.rpc('match_reference_chunks', {
        query_embedding: query,
        match_count: 8,
        filter_role: 'literature',
        prefer_section: 'Methods',
      })
      expect(preferError).toBeNull()
      expect(preferred?.[0]?.file_id).toBe(methodsId)
      expect(preferred?.some((row: { file_id: string }) => row.file_id === refsId)).toBe(true)

      const methods = await retrieveForSection(
        user.client,
        PaperType.LITERATURE_REVIEW,
        'Methods',
        'participants citation overlap',
        8
      )
      expect(methods[0]?.file_id).toBe(methodsId)
      expect(methods[0]?.section).toBe('Methods')
      expect(methods.some((row) => row.file_id === refsId)).toBe(true)
    } finally {
      await user.client.from('references').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })

  it('should fuse a stemmed FTS hit with vector ranks (hybrid RRF)', async () => {
    const user = await createConfirmedUser('ret-fts')
    const stemId = randomUUID()
    const overlapId = randomUUID()
    try {
      expect(
        (
          await user.client.from('references').insert([
            {
              file_id: stemId,
              user_id: user.id,
              document_type: 'reference',
              file_name: 'stem.txt',
              file_size: 80,
              source_role: 'literature',
            },
            {
              file_id: overlapId,
              user_id: user.id,
              document_type: 'reference',
              file_name: 'overlap.txt',
              file_size: 80,
              source_role: 'literature',
            },
          ])
        ).error
      ).toBeNull()

      const stemText = 'The team retrieved documents from the screened archive for this study.'
      const overlapText = 'documents documents documents documents protocol methods sampling'
      expect(
        (
          await user.client.from('reference_vectors').insert([
            {
              file_id: stemId,
              vector: hashEmbedding(stemText),
              chunk_text: stemText,
              chunk_index: 0,
              section: 'Methods',
              embedding_model: 'hash-384',
            },
            {
              file_id: overlapId,
              vector: hashEmbedding(overlapText),
              chunk_text: overlapText,
              chunk_index: 0,
              section: 'Methods',
              embedding_model: 'hash-384',
            },
          ])
        ).error
      ).toBeNull()

      const query = 'retrieving documents'
      const embedding = hashEmbedding(query)
      const { data: vectorOnly, error: vectorError } = await user.client.rpc('match_reference_chunks', {
        query_embedding: embedding,
        match_count: 8,
        filter_role: 'literature',
      })
      expect(vectorError).toBeNull()

      const { data: hybrid, error: hybridError } = await user.client.rpc('match_reference_chunks', {
        query_embedding: embedding,
        match_count: 8,
        filter_role: 'literature',
        query_text: query,
      })
      expect(hybridError).toBeNull()
      expect(hybrid?.some((row: { file_id: string }) => row.file_id === stemId)).toBe(true)
      expect(hybrid?.some((row: { file_id: string }) => row.file_id === overlapId)).toBe(true)
      const stemRank = hybrid?.findIndex((row: { file_id: string }) => row.file_id === stemId) ?? -1
      const vectorStemRank = vectorOnly?.findIndex((row: { file_id: string }) => row.file_id === stemId) ?? -1
      if (vectorStemRank >= 0) {
        expect(stemRank).toBeLessThanOrEqual(vectorStemRank)
      }
    } finally {
      await user.client.from('references').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })
})
