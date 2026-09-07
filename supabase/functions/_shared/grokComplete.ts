export const GROK_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
export const GROK_MODEL = 'grok-4.3'
export const MISSING_GROK_KEY_MESSAGE =
  'Save a Grok API key on Profile before generating.'
/** NFR-5: one section after retrieval must finish in under 2 minutes. */
export const GROK_SECTION_TIMEOUT_MS = 120_000
export const GROK_TIMEOUT_MESSAGE = 'Grok request timed out after 2 minutes'

type GrokChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

const isAbortError = (error: unknown): boolean =>
  (error instanceof Error && error.name === 'AbortError') ||
  (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')

export const completeWithGrok = async (
  apiKey: string,
  prompt: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = GROK_SECTION_TIMEOUT_MS
): Promise<string> => {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(GROK_TIMEOUT_MESSAGE))
    }, timeoutMs)
  })
  const request = fetcher(GROK_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: controller.signal,
  }).then(
    (response) => response,
    (error: unknown) => {
      if (controller.signal.aborted || isAbortError(error)) {
        throw new Error(GROK_TIMEOUT_MESSAGE)
      }
      throw error
    }
  )
  void request.catch(() => {})

  try {
    const response = await Promise.race([request, timedOut])
    if (!response.ok) {
      throw new Error(`Grok request failed (${response.status})`)
    }
    const json = (await response.json()) as GrokChatResponse
    const text = json.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Grok returned an empty response')
    }
    return text
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (!controller.signal.aborted) controller.abort()
  }
}
