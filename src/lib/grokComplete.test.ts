import { describe, expect, it } from 'vitest'
import { GROK_CHAT_URL, GROK_MODEL, completeWithGrok } from './grokComplete'

describe('completeWithGrok (slice 4)', () => {
  it('should POST chat completions and return the message text', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const text = await completeWithGrok('xai-test-key-not-real', 'Write Methods [S1].', async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'We measured overlap [S1].' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    expect(text).toBe('We measured overlap [S1].')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(GROK_CHAT_URL)
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get('Authorization')).toBe('Bearer xai-test-key-not-real')
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.model).toBe(GROK_MODEL)
    expect(body.messages).toEqual([{ role: 'user', content: 'Write Methods [S1].' }])
    expect(body).not.toHaveProperty('system')
  })

  it('should fail on a non-OK Grok response without echoing the body', async () => {
    await expect(
      completeWithGrok('xai-test-key-not-real', 'hello', async () =>
        new Response('secret-key-leak', { status: 401 })
      )
    ).rejects.toThrow(/Grok request failed \(401\)/)
  })
})
