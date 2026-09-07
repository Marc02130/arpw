import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { storageObjectKey } from '../../supabase/functions/upload_processor/ingest'
import { INGEST_VISIBLE_CHUNKS_MS } from '../lib/nfrBudgets'
import { NFR7_PROBE, fixturePdfBytes } from '../lib/nfr7Fixture'
import {
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
  ingestFunctionIsUp,
  storageIsUp,
} from './supabaseTest'

describe('NFR-7 fixture ingest integration', () => {
  let live = false

  beforeAll(async () => {
    await assertSupabaseUp()
    live = (await storageIsUp()) && (await ingestFunctionIsUp())
  })

  it(
    'should index a fixture PDF into visible hash-384 chunks within 2 minutes (NFR-4 / NFR-7)',
    async (ctx) => {
      if (!live) {
        ctx.skip()
        return
      }

      const user = await createConfirmedUser('nfr7')
      const fileId = randomUUID()
      const key = storageObjectKey(user.id, fileId)
      const bytes = fixturePdfBytes()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      try {
        const { error: uploadError } = await user.client.storage.from('references').upload(key, blob, {
          contentType: 'application/pdf',
          upsert: false,
        })
        expect(uploadError).toBeNull()

        const { error: insertError } = await user.client.from('references').insert({
          file_id: fileId,
          user_id: user.id,
          document_type: 'reference',
          file_name: 'nfr7-fixture.pdf',
          file_size: bytes.byteLength,
        })
        expect(insertError).toBeNull()

        const started = Date.now()
        const { data, error: fnError } = await user.client.functions.invoke('upload_processor', {
          body: {
            fileId,
            fileName: 'nfr7-fixture.pdf',
            fileSize: bytes.byteLength,
            documentType: 'reference',
          },
        })
        expect(fnError).toBeNull()
        expect(data).toMatchObject({ success: true, embeddingModel: 'hash-384' })

        const { data: vectors, error: vecError } = await user.client
          .from('reference_vectors')
          .select('chunk_text, embedding_model')
          .eq('file_id', fileId)
        const elapsed = Date.now() - started
        expect(vecError).toBeNull()
        expect(vectors?.length).toBeGreaterThan(0)
        expect(vectors?.some((row) => (row.chunk_text ?? '').includes(NFR7_PROBE))).toBe(true)
        expect(vectors?.every((row) => row.embedding_model === 'hash-384')).toBe(true)
        expect(elapsed).toBeLessThan(INGEST_VISIBLE_CHUNKS_MS)
      } finally {
        await user.client.from('references').delete().eq('user_id', user.id)
        await user.client.storage.from('references').remove([key])
        await deleteUser(user.id)
      }
    },
    INGEST_VISIBLE_CHUNKS_MS + 10_000
  )
})
