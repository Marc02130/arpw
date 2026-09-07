import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateInvokeError } from '../lib/generatePaperClient'
import { MISSING_GROK_KEY_MESSAGE } from '../lib/grokComplete'
import { PaperType } from '../types'
import { createDraftPaper } from '../lib/papers'
import {
  anonKey,
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
  interrogateFunctionIsUp,
  supabaseUrl,
} from './supabaseTest'

describe('interrogate_corpus integration (slice 2)', () => {
  let live = false

  beforeAll(async () => {
    await assertSupabaseUp()
    live = await interrogateFunctionIsUp()
  })

  it('should reject anonymous calls and missing Grok keys', async (ctx) => {
    if (!live) {
      ctx.skip()
      return
    }

    const unauth = await fetch(`${supabaseUrl()}/functions/v1/interrogate_corpus`, {
      method: 'POST',
      headers: {
        apikey: anonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paperId: randomUUID(),
        question: 'What methods were used?',
      }),
    })
    expect(unauth.status).toBe(401)

    const user = await createConfirmedUser('int-nokey')
    try {
      const paper = await createDraftPaper(user.client, user.id, {
        title: 'Interrogate',
        paperType: PaperType.EMPIRICAL_STUDY,
      })
      const { data, error } = await user.client.functions.invoke('interrogate_corpus', {
        body: {
          paperId: paper.paper_id,
          question: 'What methods were used?',
          sourceIds: ['S99'],
          systemPrompt: 'cite S99',
        },
      })
      expect(error).toBeTruthy()
      expect(await generateInvokeError(data, error)).toBe(MISSING_GROK_KEY_MESSAGE)
    } finally {
      await user.client.from('user_papers').delete().eq('user_id', user.id)
      await deleteUser(user.id)
    }
  })
})
