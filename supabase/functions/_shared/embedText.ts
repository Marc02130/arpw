import {
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  hashEmbedding,
} from '../upload_processor/ingest.ts'

export const HASH_EMBEDDING_MODEL = EMBEDDING_MODEL
export const HOSTED_EMBEDDING_MODEL = 'grok-embedding-small'
export const GROK_EMBED_URL = 'https://api.x.ai/v1/embeddings'
export const HOSTED_EMBED_TIMEOUT_MS = 60_000

export type EmbedPurpose = 'query' | 'passage'

export type QueryEmbedResult = {
  vector: number[]
  model: string
}

export type QueryEmbedFn = (text: string) => Promise<QueryEmbedResult>

const isAbortError = (error: unknown): boolean =>
  (error instanceof Error && error.name === 'AbortError') ||
  (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')

export const l2Normalize = (vec: number[]): number[] => {
  let norm = 0
  for (const value of vec) norm += value * value
  const scale = Math.sqrt(norm) || 1
  return vec.map((value) => value / scale)
}

export const toEmbeddingDims = (vec: number[], dims = EMBEDDING_DIMS): number[] => {
  if (vec.length < dims) {
    throw new Error(`Embedding length ${vec.length} is below ${dims}`)
  }
  return l2Normalize(vec.length === dims ? vec : vec.slice(0, dims))
}

export const prefixForPurpose = (text: string, purpose: EmbedPurpose): string =>
  purpose === 'query' ? `query: ${text}` : `passage: ${text}`

export const hashQueryEmbed: QueryEmbedFn = async (text) => ({
  vector: hashEmbedding(text),
  model: HASH_EMBEDDING_MODEL,
})

type GrokEmbedResponse = {
  data?: Array<{ index?: number; embedding?: number[] }>
}

export const embedWithGrok = async (
  apiKey: string,
  texts: string[],
  purpose: EmbedPurpose,
  fetcher: typeof fetch = fetch,
  timeoutMs = HOSTED_EMBED_TIMEOUT_MS
): Promise<number[][]> => {
  if (texts.length === 0) return []
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Grok embedding timed out'))
    }, timeoutMs)
  })
  const request = fetcher(GROK_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HOSTED_EMBEDDING_MODEL,
      input: texts.map((text) => prefixForPurpose(text, purpose)),
      dimensions: EMBEDDING_DIMS,
      encoding_format: 'float',
    }),
    signal: controller.signal,
  }).then(
    (response) => response,
    (error: unknown) => {
      if (controller.signal.aborted || isAbortError(error)) {
        throw new Error('Grok embedding timed out')
      }
      throw error
    }
  )
  void request.catch(() => {})

  try {
    const response = await Promise.race([request, timedOut])
    if (!response.ok) {
      throw new Error(`Grok embedding failed (${response.status})`)
    }
    const json = (await response.json()) as GrokEmbedResponse
    const rows = Array.isArray(json.data) ? [...json.data] : []
    rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    if (rows.length !== texts.length) {
      throw new Error('Grok embedding count mismatch')
    }
    return rows.map((row) => {
      if (!Array.isArray(row.embedding) || row.embedding.length === 0) {
        throw new Error('Grok embedding was empty')
      }
      return toEmbeddingDims(row.embedding.map((value) => Number(value)))
    })
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (!controller.signal.aborted) controller.abort()
  }
}

const EMBED_BATCH = 32

export const embedTexts = async (
  texts: string[],
  opts: {
    apiKey?: string | null
    purpose: EmbedPurpose
    fetcher?: typeof fetch
    allowHashFallback?: boolean
  }
): Promise<{ vectors: number[][]; model: string }> => {
  const key = opts.apiKey?.trim()
  if (key) {
    try {
      const vectors: number[][] = []
      for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const batch = texts.slice(i, i + EMBED_BATCH)
        vectors.push(
          ...(await embedWithGrok(key, batch, opts.purpose, opts.fetcher ?? fetch))
        )
      }
      return { vectors, model: HOSTED_EMBEDDING_MODEL }
    } catch (error) {
      if (opts.allowHashFallback === false) throw error
    }
  }
  return {
    vectors: texts.map((text) => hashEmbedding(text)),
    model: HASH_EMBEDDING_MODEL,
  }
}

export const grokQueryEmbed = (
  apiKey: string,
  fetcher: typeof fetch = fetch
): QueryEmbedFn => async (text) => {
  const result = await embedTexts([text], {
    apiKey,
    purpose: 'query',
    fetcher,
    allowHashFallback: true,
  })
  return { vector: result.vectors[0], model: result.model }
}
