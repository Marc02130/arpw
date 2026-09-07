import { describe, expect, it } from 'vitest'
import type { SentenceAttribution } from './attribution'
import { DRAFT_DISCLAIMER, markUncitedInDraft, previewWarnings } from './draftPreview'
import { runCitationCheck } from './citationCheck'
import { runFormatCheck } from './formatCheck'

const uncited = (sentence: string, section = 'Methods'): SentenceAttribution => ({
  sentence,
  section,
  citedSids: [],
  vectorIds: [],
  fileIds: [],
  quoteSpans: [],
  uncited: true,
})

describe('draft preview (QUAL-4)', () => {
  it('should require the human-review disclaimer', () => {
    expect(DRAFT_DISCLAIMER).toMatch(/AI-generated draft/i)
    expect(DRAFT_DISCLAIMER).toMatch(/human review/i)
    expect(DRAFT_DISCLAIMER).toMatch(/not a factual-accuracy score/i)
  })

  it('should list citation, format, and uncited warnings', () => {
    const warnings = previewWarnings({
      uncited: [uncited('We measured overlap without a source.')],
      citationCheck: runCitationCheck({
        content: 'A claim [S99].',
        allowedSids: ['S1'],
        citedFileIds: [],
        paperReferenceFileIds: [],
      }),
      formatCheck: runFormatCheck({
        content: '## Abstract\n\nHi.',
        requiredSections: ['Abstract', 'Methods'],
      }),
    })
    expect(warnings.some((row) => row.kind === 'citation' && row.message.includes('S99'))).toBe(true)
    expect(warnings.some((row) => row.kind === 'format' && row.message.includes('Methods'))).toBe(true)
    expect(warnings.some((row) => row.kind === 'uncited' && row.message.includes('Methods'))).toBe(true)
  })

  it('should mark uncited sentences inline in the draft', () => {
    const sentence = 'We measured overlap without a source.'
    const segments = markUncitedInDraft(`## Methods\n\n${sentence}\n\nDone.`, [uncited(sentence)])
    expect(segments.filter((row) => row.warning).map((row) => row.text)).toEqual([sentence])
    expect(segments.some((row) => !row.warning && row.text.includes('## Methods'))).toBe(true)
  })
})
