export const GROK_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
export const GROK_MODEL = 'grok-4.3'
export const MISSING_GROK_KEY_MESSAGE =
  'Save a Grok API key on Profile before generating.'

type GrokChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

export const completeWithGrok = async (
  apiKey: string,
  prompt: string,
  fetcher: typeof fetch = fetch
): Promise<string> => {
  const response = await fetcher(GROK_CHAT_URL, {
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
  })
  if (!response.ok) {
    throw new Error(`Grok request failed (${response.status})`)
  }
  const json = (await response.json()) as GrokChatResponse
  const text = json.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Grok returned an empty response')
  }
  return text
}
