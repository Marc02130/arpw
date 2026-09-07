import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  EMBEDDING_DIMS,
  MIN_CHUNK_CHARS,
  chunkText,
  hashEmbedding,
  validateIngestFile,
} from '../../supabase/functions/upload_processor/ingest'
import { NFR7_PROBE, NFR7_TEXT, fixturePdfBytes } from './nfr7Fixture'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

describe('NFR-7 fixture ingest (unit)', () => {
  it('should be a non-empty pdf under 10MB', () => {
    const bytes = fixturePdfBytes()
    expect(validateIngestFile('nfr7-fixture.pdf', bytes.byteLength)).toBeNull()
    expect(bytes.byteLength).toBeGreaterThan(100)
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe('%PDF-1.4')
    expect(NFR7_TEXT.length).toBeGreaterThan(MIN_CHUNK_CHARS)
  })

  it('should embed the probe token in the PDF bytes', () => {
    const ascii = new TextDecoder('latin1').decode(fixturePdfBytes())
    expect(ascii).toContain(NFR7_PROBE)
  })

  it('should extract the probe token from the fixture PDF', async () => {
    const parsed = await pdfParse(Buffer.from(fixturePdfBytes()))
    expect(parsed.text.toLowerCase()).toContain(NFR7_PROBE)
  })

  it('should chunk the fixture text onto a hash-384 vector that keeps the probe', () => {
    const chunks = chunkText(NFR7_TEXT)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.some((chunk) => chunk.text.includes(NFR7_PROBE))).toBe(true)
    const vec = hashEmbedding(chunks[0].text)
    expect(vec).toHaveLength(EMBEDDING_DIMS)
    const norm = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0))
    expect(norm).toBeCloseTo(1, 5)
  })
})
