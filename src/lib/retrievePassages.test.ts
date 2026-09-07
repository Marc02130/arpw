import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import { getSectionTemplate } from './generationTemplates'
import { formatStyleForPrompt, retrievalAttempts } from './retrievePassages'

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
