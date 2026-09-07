import { describe, expect, it } from 'vitest'
import {
  EMBEDDING_DIMS,
  chunkText,
  hashEmbedding,
  storageTarget,
  textFromDocxXml,
  validateIngestFile,
} from '../../supabase/functions/upload_processor/ingest'

describe('storageTarget (DOCS-5)', () => {
  it('should take the bucket from document type, not the path', () => {
    expect(storageTarget('reference', 'abc_paper.pdf')).toEqual({
      bucket: 'references',
      key: 'abc_paper.pdf',
    })
    expect(storageTarget('example', 'uuid_style.txt')).toEqual({
      bucket: 'examples',
      key: 'uuid_style.txt',
    })
  })

  it('should ignore a client-supplied bucket prefix', () => {
    expect(storageTarget('reference', 'wrong-bucket/abc_paper.pdf')).toEqual({
      bucket: 'references',
      key: 'abc_paper.pdf',
    })
  })

  it('should reject an empty key', () => {
    expect(() => storageTarget('reference', '/')).toThrow('Missing storage key')
  })
})

describe('validateIngestFile', () => {
  it('should accept pdf, docx, and txt under 10MB', () => {
    expect(validateIngestFile('a.pdf', 100)).toBeNull()
    expect(validateIngestFile('a.docx', 100)).toBeNull()
    expect(validateIngestFile('a.txt', 100)).toBeNull()
  })

  it('should reject .doc, empty, and oversize files', () => {
    expect(validateIngestFile('a.doc', 100)).toContain('Unsupported file type')
    expect(validateIngestFile('a.pdf', 0)).toBe('File is empty')
    expect(validateIngestFile('a.pdf', 11 * 1024 * 1024)).toContain('exceeds 10MB')
  })
})

describe('textFromDocxXml', () => {
  it('should strip Word XML and keep paragraph text', () => {
    const xml =
      '<w:document><w:p><w:r><w:t>Hello</w:t></w:r></w:p><w:p><w:r><w:t>World</w:t></w:r></w:p></w:document>'
    expect(textFromDocxXml(xml)).toBe('Hello\nWorld')
  })
})

describe('chunkText', () => {
  it('should return no chunks for tiny text', () => {
    expect(chunkText('too short')).toEqual([])
  })

  it('should split long text with overlap and index', () => {
    const text = 'Section one. '.repeat(200)
    const chunks = chunkText(text, 100, 20)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[1].chunkIndex).toBe(1)
    expect(chunks[0].text.length).toBeGreaterThanOrEqual(50)
    expect(chunks[0].section.length).toBeGreaterThan(0)
  })
})

describe('hashEmbedding', () => {
  it('should return a 384-d unit vector', () => {
    const vec = hashEmbedding('citation methods results')
    expect(vec).toHaveLength(EMBEDDING_DIMS)
    const norm = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it('should be deterministic and similar for shared tokens', () => {
    const a = hashEmbedding('neural network training')
    const b = hashEmbedding('neural network training')
    const c = hashEmbedding('completely different tokens xyz')
    expect(a).toEqual(b)
    const dot = (x: number[], y: number[]) => x.reduce((s, n, i) => s + n * y[i], 0)
    expect(dot(a, b)).toBeCloseTo(1, 5)
    expect(dot(a, c)).toBeLessThan(0.5)
  })
})
