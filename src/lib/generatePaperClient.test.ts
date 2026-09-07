import { describe, expect, it } from 'vitest'
import { MISSING_GROK_KEY_MESSAGE } from './grokComplete'
import { generateInvokeError } from './generatePaperClient'

describe('generateInvokeError (slice 4)', () => {
  it('should prefer the function JSON error over the generic invoke message', async () => {
    const message = await generateInvokeError(
      { success: false, error: MISSING_GROK_KEY_MESSAGE, code: 'missing_grok_key' },
      { message: 'Edge Function returned a non-2xx status code' }
    )
    expect(message).toBe(MISSING_GROK_KEY_MESSAGE)
  })

  it('should read JSON from a FunctionsHttpError response context', async () => {
    const message = await generateInvokeError(null, {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: async () => ({ success: false, error: MISSING_GROK_KEY_MESSAGE }),
      },
    })
    expect(message).toBe(MISSING_GROK_KEY_MESSAGE)
  })
})
