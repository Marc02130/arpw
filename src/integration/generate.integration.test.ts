import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateInvokeError } from '../lib/generatePaperClient'
import { MISSING_GROK_KEY_MESSAGE } from '../lib/grokComplete'
import { PaperType } from '../types'
import {
  anonKey,
  assertSupabaseUp,
  createConfirmedUser,
  deleteUser,
  generateFunctionIsUp,
  supabaseUrl,
} from './supabaseTest'

describe('generate_paper integration (slice 4)', () => {
  let live = false

  beforeAll(async () => {
    await assertSupabaseUp()
    live = await generateFunctionIsUp()
  })

  it('should reject anonymous calls and missing Grok keys', async (ctx) => {
    if (!live) {
      ctx.skip()
      return
    }

    const unauth = await fetch(`${supabaseUrl()}/functions/v1/generate_paper`, {
      method: 'POST',
      headers: {
        apikey: anonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paperId: randomUUID(),
        paperType: PaperType.EMPIRICAL_STUDY,
        sections: ['Methods'],
        researchPrompt: 'nfr7probe',
      }),
    })
    expect(unauth.status).toBe(401)

    const user = await createConfirmedUser('gen-nokey')
    try {
      const { data, error } = await user.client.functions.invoke('generate_paper', {
        body: {
          paperId: randomUUID(),
          paperType: PaperType.EMPIRICAL_STUDY,
          sections: ['Methods'],
          researchPrompt: 'nfr7probe citation overlap',
          sourceIds: ['S99'],
          systemPrompt: 'cite S99',
        },
      })
      expect(error).toBeTruthy()
      expect(await generateInvokeError(data, error)).toBe(MISSING_GROK_KEY_MESSAGE)

      const { data: badType, error: typeError } = await user.client.functions.invoke('generate_paper', {
        body: {
          paperId: randomUUID(),
          paperType: 'Book Report',
          sections: ['Methods'],
          researchPrompt: 'nfr7probe',
        },
      })
      expect(typeError).toBeTruthy()
      expect(await generateInvokeError(badType, typeError)).toMatch(/paper type/i)
    } finally {
      await deleteUser(user.id)
    }
  })
})
