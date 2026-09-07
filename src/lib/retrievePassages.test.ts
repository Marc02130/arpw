import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import { getSectionTemplate } from './generationTemplates'
import { retrievalAttempts } from './retrievePassages'

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
