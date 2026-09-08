import { beforeAll, describe, expect, it } from 'vitest'
import { EMBEDDING_DIMS } from '../../supabase/functions/upload_processor/ingest'
import { HASH_EMBEDDING_MODEL } from '../lib/embedText'
import { invokeEmbedText } from '../lib/embedTextClient'
import { assertSupabaseUp, createConfirmedUser, deleteUser, embedFunctionIsUp } from './supabaseTest'

describe('embed_text integration', () => {
  let live = false

  beforeAll(async () => {
    await assertSupabaseUp()
    live = await embedFunctionIsUp()
  })

  it('should return a hash-384 vector when the user has no Grok key', async (ctx) => {
    if (!live) {
      ctx.skip()
      return
    }

    const user = await createConfirmedUser('embed-hash')
    try {
      const result = await invokeEmbedText(user.client, 'citation overlap methods', 'query')
      expect(result.model).toBe(HASH_EMBEDDING_MODEL)
      expect(result.vector).toHaveLength(EMBEDDING_DIMS)
    } finally {
      await deleteUser(user.id)
    }
  })
})
