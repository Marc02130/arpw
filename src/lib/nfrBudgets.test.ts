import { describe, expect, it } from 'vitest'
import { GROK_SECTION_TIMEOUT_MS, INGEST_VISIBLE_CHUNKS_MS } from './nfrBudgets'

describe('NFR-4 / NFR-5 time budgets', () => {
  it('should cap ingest-to-visible-chunks and one-section generate at 2 minutes', () => {
    expect(INGEST_VISIBLE_CHUNKS_MS).toBe(120_000)
    expect(GROK_SECTION_TIMEOUT_MS).toBe(120_000)
  })
})
