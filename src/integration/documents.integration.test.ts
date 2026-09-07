import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import {
  adminClient,
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
} from './supabaseTest'

describe('document metadata integration', () => {
  beforeAll(assertSupabaseUp)

  it('should insert a txt reference, list it, and delete vectors plus the row', async () => {
    const user = await createConfirmedUser('docs')
    const fileId = randomUUID()
    try {
      const { error: insertError } = await user.client.from('references').insert({
        file_id: fileId,
        user_id: user.id,
        document_type: 'reference',
        file_name: 'paper.txt',
        file_size: 32,
      })
      expect(insertError).toBeNull()

      const { error: vecError } = await user.client.from('reference_vectors').insert({
        file_id: fileId,
        vector: hashEmbedding('methods and results of the study'),
        chunk_text: 'methods and results of the study',
        chunk_index: 0,
        section: 'methods and results of the study',
        embedding_model: 'hash-384',
      })
      expect(vecError).toBeNull()

      const { data: list, error: listError } = await user.client
        .from('references')
        .select('file_id, file_name, file_size, uploaded_at')
        .eq('file_id', fileId)
        .single()
      expect(listError).toBeNull()
      expect(list?.file_name).toBe('paper.txt')
      expect(list?.file_size).toBe(32)
      expect(list?.uploaded_at).toBeTruthy()

      const { error: vecDel } = await user.client.from('reference_vectors').delete().eq('file_id', fileId)
      expect(vecDel).toBeNull()
      const { error: rowDel } = await user.client
        .from('references')
        .delete()
        .eq('file_id', fileId)
        .eq('user_id', user.id)
      expect(rowDel).toBeNull()

      const { data: gone } = await user.client.from('references').select('file_id').eq('file_id', fileId)
      expect(gone).toEqual([])
      const { data: vecGone } = await user.client.from('reference_vectors').select('file_id').eq('file_id', fileId)
      expect(vecGone).toEqual([])
    } finally {
      await adminClient().from('references').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })

  it('should reject a .doc filename on references and examples', async () => {
    const user = await createConfirmedUser('docs-ext')
    try {
      const { error: refError } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'legacy.doc',
        file_size: 20,
      })
      expect(refError?.message).toMatch(/references_file_name_ext|check constraint/i)

      const { error: exError } = await user.client.from('examples').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'example',
        file_name: 'legacy.doc',
        file_size: 20,
      })
      expect(exError?.message).toMatch(/examples_file_name_ext|check constraint/i)
    } finally {
      await deleteUser(user.id)
    }
  })

  it('should block an 11th example paper', async () => {
    const user = await createConfirmedUser('docs-ex-cap')
    try {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'example' as const,
        file_name: `style-${i}.txt`,
        file_size: 12,
      }))
      const { error: seedError } = await user.client.from('examples').insert(rows)
      expect(seedError).toBeNull()

      const { error: eleventh } = await user.client.from('examples').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'example',
        file_name: 'style-10.txt',
        file_size: 12,
      })
      expect(eleventh?.message).toMatch(/Example cap of 10/i)
    } finally {
      await adminClient().from('examples').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })

  it('should insert an example, list it, and delete example vectors plus the row', async () => {
    const user = await createConfirmedUser('docs-ex')
    const fileId = randomUUID()
    try {
      const { error: insertError } = await user.client.from('examples').insert({
        file_id: fileId,
        user_id: user.id,
        document_type: 'example',
        file_name: 'style.txt',
        file_size: 24,
      })
      expect(insertError).toBeNull()

      const { error: vecError } = await user.client.from('example_vectors').insert({
        file_id: fileId,
        vector: hashEmbedding('this paper uses short sentences'),
        chunk_text: 'this paper uses short sentences',
        chunk_index: 0,
        section: 'this paper uses short sentences',
        embedding_model: 'hash-384',
      })
      expect(vecError).toBeNull()

      const { data: list, error: listError } = await user.client
        .from('examples')
        .select('file_id, file_name, file_size')
        .eq('file_id', fileId)
        .single()
      expect(listError).toBeNull()
      expect(list?.file_name).toBe('style.txt')

      const { error: vecDel } = await user.client.from('example_vectors').delete().eq('file_id', fileId)
      expect(vecDel).toBeNull()
      const { error: rowDel } = await user.client
        .from('examples')
        .delete()
        .eq('file_id', fileId)
        .eq('user_id', user.id)
      expect(rowDel).toBeNull()

      const { data: gone } = await user.client.from('examples').select('file_id').eq('file_id', fileId)
      expect(gone).toEqual([])
    } finally {
      await adminClient().from('examples').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })

  it('should reject empty and oversized files and the wrong document_type', async () => {
    const user = await createConfirmedUser('docs-check')
    try {
      const { error: empty } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'empty.txt',
        file_size: 0,
      })
      expect(empty?.message).toMatch(/file_size|check constraint/i)

      const { error: oversized } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'huge.txt',
        file_size: 10_485_761,
      })
      expect(oversized?.message).toMatch(/file_size|check constraint/i)

      const { error: wrongType } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'example',
        file_name: 'wrong.txt',
        file_size: 20,
      })
      expect(wrongType?.message).toMatch(/document_type|check constraint/i)

      const { error: pdfOk } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'paper.pdf',
        file_size: 20,
      })
      expect(pdfOk).toBeNull()

      const { error: docxOk } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'paper.docx',
        file_size: 20,
      })
      expect(docxOk).toBeNull()
    } finally {
      await adminClient().from('references').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })

  it('should block a 501st reference after 500 rows', async () => {
    const user = await createConfirmedUser('docs-ref-cap')
    const admin = adminClient()
    try {
      const batch: Array<Record<string, unknown>> = []
      for (let i = 0; i < 499; i += 1) {
        batch.push({
          file_id: randomUUID(),
          user_id: user.id,
          document_type: 'reference',
          file_name: `ref-${i}.txt`,
          file_size: 10,
        })
      }
      for (let i = 0; i < batch.length; i += 100) {
        const { error } = await admin.from('references').insert(batch.slice(i, i + 100))
        expect(error).toBeNull()
      }

      const { error: fiveHundred } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'ref-499.txt',
        file_size: 10,
      })
      expect(fiveHundred).toBeNull()

      const { error: fiveOhOne } = await user.client.from('references').insert({
        file_id: randomUUID(),
        user_id: user.id,
        document_type: 'reference',
        file_name: 'ref-500.txt',
        file_size: 10,
      })
      expect(fiveOhOne?.message).toMatch(/Reference cap of 500/i)
    } finally {
      await admin.from('references').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })
})
