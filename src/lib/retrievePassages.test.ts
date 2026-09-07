import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import { getSectionTemplate } from './generationTemplates'
import {
  filterPinsForSection,
  formatStyleForPrompt,
  mergePinnedFirst,
  parseInterrogateFilter,
  retrievalAttempts,
  unionPrimaryForSection,
  type EvidencePin,
} from './retrievePassages'

describe('retrievalAttempts (slice 3)', () => {
  it('should skip references and try primary then literature for empirical methods', () => {
    expect(retrievalAttempts('none')).toEqual([])
    expect(retrievalAttempts('literature')).toEqual(['literature'])
    expect(retrievalAttempts('both')).toEqual(['both'])
    expect(retrievalAttempts('primary')).toEqual(['primary', 'literature'])
    expect(
      retrievalAttempts(getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'Methods').preferredSourceRole)
    ).toEqual(['primary', 'literature'])
    expect(
      retrievalAttempts(getSectionTemplate(PaperType.LITERATURE_REVIEW, 'Methods').preferredSourceRole)
    ).toEqual(['literature'])
    expect(
      retrievalAttempts(getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'References').preferredSourceRole)
    ).toEqual([])
  })
})

describe('parseInterrogateFilter (slice 2)', () => {
  it('should keep literature or primary and default everything else to both', () => {
    expect(parseInterrogateFilter('literature')).toBe('literature')
    expect(parseInterrogateFilter('primary')).toBe('primary')
    expect(parseInterrogateFilter('both')).toBe('both')
    expect(parseInterrogateFilter('example')).toBe('both')
    expect(parseInterrogateFilter(undefined)).toBe('both')
  })
})

describe('pin-first retrieval (PIN-2)', () => {
  const pin = (overrides: Partial<EvidencePin>): EvidencePin => ({
    vector_id: 'pin-vec',
    file_id: 'pin-file',
    chunk_text: 'pinned methods',
    section: 'methods',
    source_role: 'primary',
    score: 1,
    paperSection: '',
    pinned: true,
    target_section: 'Methods',
    ...overrides,
  })

  it('should keep unscoped and matching-section pins and drop examples and other sections', () => {
    const pins = [
      pin({ vector_id: 'm', target_section: 'Methods' }),
      pin({ vector_id: 'any', target_section: null, source_role: 'literature' }),
      pin({ vector_id: 'intro', target_section: 'Introduction' }),
      pin({ vector_id: 'ex', source_role: 'example', target_section: null }),
    ]
    const methods = filterPinsForSection(pins, 'Methods', PaperType.EMPIRICAL_STUDY)
    expect(methods.map((row) => row.vector_id)).toEqual(['m', 'any'])
    expect(filterPinsForSection(pins, 'References', PaperType.EMPIRICAL_STUDY)).toEqual([])
    expect(
      filterPinsForSection(pins, 'Methods', PaperType.LITERATURE_REVIEW).map((row) => row.vector_id)
    ).toEqual(['any'])
  })

  it('should put pins ahead of vector hits and skip duplicate vector ids and example rows', () => {
    const merged = mergePinnedFirst(
      [pin({ vector_id: 'p1' })],
      [
        {
          vector_id: 'p1',
          file_id: 'pin-file',
          chunk_text: 'same chunk from search',
          section: 'methods',
          source_role: 'primary',
          score: 0.2,
          paperSection: 'Methods',
        },
        {
          vector_id: 'r1',
          file_id: 'other',
          chunk_text: 'retrieved',
          section: 'methods',
          source_role: 'literature',
          score: 0.4,
          paperSection: 'Methods',
        },
        {
          vector_id: 'ex',
          file_id: 'example',
          chunk_text: 'style',
          section: 'methods',
          source_role: 'example',
          score: 0.9,
          paperSection: 'Methods',
        },
      ]
    )
    expect(merged.map((row) => row.vector_id)).toEqual(['p1', 'r1'])
    expect(merged[0].pinned).toBe(true)
  })

  it('should union primary into empirical abstract and introduction only', () => {
    expect(unionPrimaryForSection(PaperType.EMPIRICAL_STUDY, 'Abstract')).toBe(true)
    expect(unionPrimaryForSection(PaperType.EMPIRICAL_STUDY, 'Introduction')).toBe(true)
    expect(unionPrimaryForSection(PaperType.EMPIRICAL_STUDY, 'Methods')).toBe(false)
    expect(unionPrimaryForSection(PaperType.LITERATURE_REVIEW, 'Abstract')).toBe(false)
  })
})

describe('formatStyleForPrompt (GEN-7)', () => {
  it('should label example chunks as style only', () => {
    expect(formatStyleForPrompt([])).toBe('')
    expect(
      formatStyleForPrompt([
        {
          vector_id: 'v',
          file_id: 'f',
          chunk_text: 'Short methods sentences.',
          section: 'methods',
          source_role: 'example',
          score: 0.1,
          paperSection: 'Methods',
        },
      ])
    ).toMatch(/style only/i)
  })
})
