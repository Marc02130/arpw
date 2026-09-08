import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIMS, hashEmbedding } from '../../supabase/functions/upload_processor/ingest'
import {
  GROK_EMBED_URL,
  HASH_EMBEDDING_MODEL,
  HOSTED_EMBEDDING_MODEL,
  embedTexts,
  embedWithGrok,
  hashQueryEmbed,
  prefixForPurpose,
  toEmbeddingDims,
} from './embedText'

describe('toEmbeddingDims', () => {
  it('should keep a 384-d unit vector and truncate a longer one', () => {
    const exact = Array.from({ length: EMBEDDING_DIMS }, (_, i) => (i === 0 ? 1 : 0))
    expect(toEmbeddingDims(exact)).toHaveLength(EMBEDDING_DIMS)
    const long = Array.from({ length: 768 }, (_, i) => (i < 10 ? 1 : 0))
    const truncated = toEmbeddingDims(long)
    expect(truncated).toHaveLength(EMBEDDING_DIMS)
    const norm = Math.sqrt(truncated.reduce((sum, n) => sum + n * n, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it('should reject a vector shorter than 384', () => {
    expect(() => toEmbeddingDims([0.1, 0.2])).toThrow(/below 384/)
  })
})

describe('embedTexts', () => {
  it('should hash when no Grok key is saved', async () => {
    const text = 'citation overlap methods'
    const result = await embedTexts([text], { purpose: 'passage' })
    expect(result.model).toBe(HASH_EMBEDDING_MODEL)
    expect(result.vectors[0]).toEqual(hashEmbedding(text))
  })

  it('should POST grok-embedding-small at 384-d with query/passage prefixes', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const hosted = Array.from({ length: EMBEDDING_DIMS }, (_, i) => (i === 3 ? 2 : 0))
    const result = await embedTexts(['nfr7probe methods'], {
      apiKey: 'xai-test-key-not-real',
      purpose: 'query',
      allowHashFallback: false,
      fetcher: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
        return new Response(
          JSON.stringify({ data: [{ index: 0, embedding: hosted }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      },
    })
    expect(result.model).toBe(HOSTED_EMBEDDING_MODEL)
    expect(result.vectors[0]).toHaveLength(EMBEDDING_DIMS)
    expect(calls[0].url).toBe(GROK_EMBED_URL)
    expect(calls[0].body.model).toBe(HOSTED_EMBEDDING_MODEL)
    expect(calls[0].body.dimensions).toBe(EMBEDDING_DIMS)
    expect(calls[0].body.input).toEqual([prefixForPurpose('nfr7probe methods', 'query')])
  })

  it('should fall back to hash-384 when the hosted call fails', async () => {
    const text = 'citation overlap methods'
    const result = await embedTexts([text], {
      apiKey: 'xai-test-key-not-real',
      purpose: 'passage',
      fetcher: async () => new Response('nope', { status: 401 }),
    })
    expect(result.model).toBe(HASH_EMBEDDING_MODEL)
    expect(result.vectors[0]).toEqual(hashEmbedding(text))
  })

  it('should not echo a failed Grok embedding body', async () => {
    await expect(
      embedWithGrok('xai-test-key-not-real', ['hello'], 'passage', async () =>
        new Response('secret-key-leak', { status: 401 })
      )
    ).rejects.toThrow(/Grok embedding failed \(401\)/)
  })
})

describe('hashQueryEmbed', () => {
  it('should return a hash-384 query vector', async () => {
    const result = await hashQueryEmbed('methods')
    expect(result.model).toBe(HASH_EMBEDDING_MODEL)
    expect(result.vector).toEqual(hashEmbedding('methods'))
  })
})
