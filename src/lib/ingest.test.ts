import { describe, expect, it } from 'vitest'
import {
  EMBEDDING_DIMS,
  OTHER_SECTION,
  UNKNOWN_SECTION,
  chunkLines,
  chunkPages,
  chunkText,
  hashEmbedding,
  linesFromDocxXml,
  parseHeading,
  storageObjectKey,
  storageTarget,
  textFromDocxXml,
  userOwnsStorageKey,
  validateIngestFile,
} from '../../supabase/functions/upload_processor/ingest'

describe('storageTarget (NFR-2)', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const fileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  it('should take the bucket from document type and the key from auth user + file id', () => {
    expect(storageTarget('reference', userId, fileId)).toEqual({
      bucket: 'references',
      key: `${userId}/${fileId}`,
    })
    expect(storageTarget('example', userId, fileId)).toEqual({
      bucket: 'examples',
      key: `${userId}/${fileId}`,
    })
    expect(storageTarget('reference', userId, fileId).key).toBe(storageObjectKey(userId, fileId))
  })

  it('should not use a client filename or storage path as the object key', () => {
    const { key } = storageTarget('reference', userId, fileId)
    expect(key).not.toContain('paper.pdf')
    expect(key).not.toContain('wrong-bucket')
    expect(key.split('/')).toEqual([userId, fileId])
  })

  it('should reject ids that are not uuids', () => {
    expect(() => storageTarget('reference', userId, '../secret')).toThrow(
      'Storage path requires user id and file id'
    )
    expect(() => storageTarget('reference', 'not-a-user', fileId)).toThrow(
      'Storage path requires user id and file id'
    )
  })
})

describe('userOwnsStorageKey (NFR-1)', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const otherId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const fileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  it('should allow only keys under the user prefix', () => {
    expect(userOwnsStorageKey(userId, `${userId}/${fileId}`)).toBe(true)
    expect(userOwnsStorageKey(userId, `${otherId}/${fileId}`)).toBe(false)
    expect(userOwnsStorageKey(userId, `${fileId}_paper.pdf`)).toBe(false)
    expect(userOwnsStorageKey(userId, userId)).toBe(false)
    expect(userOwnsStorageKey(userId, `${userId}/`)).toBe(false)
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

describe('parseHeading', () => {
  it('should map IMRaD aliases and numbered or markdown headings', () => {
    expect(parseHeading('Methods')).toBe('Methods')
    expect(parseHeading('METHODS')).toBe('Methods')
    expect(parseHeading('Materials and Methods')).toBe('Methods')
    expect(parseHeading('## Results')).toBe('Results')
    expect(parseHeading('1. Introduction')).toBe('Introduction')
    expect(parseHeading('IV. Discussion')).toBe('Discussion')
    expect(parseHeading('Bibliography')).toBe('References')
    expect(parseHeading('Works Cited')).toBe('References')
    expect(parseHeading('Appendix A')).toBe(OTHER_SECTION)
  })

  it('should not treat a sentence that mentions methods as a heading', () => {
    expect(parseHeading('In this methods paper we measured overlap.')).toBeNull()
    expect(parseHeading('Methods were as follows, then we sampled.')).toBeNull()
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
    expect(chunks[0].section).toBe(UNKNOWN_SECTION)
    expect(chunks[0].page).toBeNull()
  })

  it('should not mix bibliography into Methods windows', () => {
    const methodsBody =
      'We recruited twelve participants for a citation overlap task and logged every trial. '.repeat(6)
    const refsBody = 'Smith, A. (2020). Unrelated bibliography on climate policy and trade. '.repeat(6)
    const chunks = chunkText(`Methods\n\n${methodsBody}\n\nReferences\n\n${refsBody}`, 120, 40)
    const methods = chunks.filter((chunk) => chunk.section === 'Methods')
    const refs = chunks.filter((chunk) => chunk.section === 'References')
    expect(methods.length).toBeGreaterThan(0)
    expect(refs.length).toBeGreaterThan(0)
    expect(methods.every((chunk) => !chunk.text.includes('Smith, A. (2020)'))).toBe(true)
    expect(refs.every((chunk) => !chunk.text.includes('We recruited twelve participants'))).toBe(true)
  })
})

describe('chunkPages', () => {
  it('should keep the PDF page of the section heading', () => {
    const methods =
      'We recruited twelve participants for a citation overlap task and logged every trial in a private file.'
    const refs = 'Smith, A. (2020). Unrelated bibliography entry that must not mix into methods chunks.'
    const chunks = chunkPages([`Methods\n\n${methods}`, `References\n\n${refs}`])
    expect(chunks.find((chunk) => chunk.section === 'Methods')?.page).toBe(1)
    expect(chunks.find((chunk) => chunk.section === 'References')?.page).toBe(2)
    expect(chunks.find((chunk) => chunk.section === 'Methods')?.text).not.toContain('Smith, A. (2020)')
  })
})

describe('linesFromDocxXml', () => {
  it('should treat Heading styles as section breaks', () => {
    const xml = [
      '<w:document>',
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>We recruited twelve participants for a citation overlap task and logged every trial.</w:t></w:r></w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>References</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Smith, A. (2020). Unrelated bibliography entry that must not mix into methods chunks.</w:t></w:r></w:p>',
      '</w:document>',
    ].join('')
    const lines = linesFromDocxXml(xml)
    expect(lines[0]).toMatchObject({ text: 'Methods', isHeading: true })
    const fromDocx = chunkLines(lines)
    expect(fromDocx.find((chunk) => chunk.section === 'Methods')?.text).toContain('twelve participants')
    expect(fromDocx.find((chunk) => chunk.section === 'Methods')?.text).not.toContain('Smith, A. (2020)')
    expect(fromDocx.find((chunk) => chunk.section === 'References')?.text).toContain('Smith, A. (2020)')
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
