import { describe, expect, it } from 'vitest'
import type { SentenceAttribution } from './attribution'
import {
  citationCheckLabel,
  citationInputsFromAttribution,
  runCitationCheck,
} from './citationCheck'
import { extractSids } from './citations'

const row = (overrides: Partial<SentenceAttribution>): SentenceAttribution => ({
  sentence: 'We measured overlap [S1].',
  section: 'Methods',
  citedSids: ['S1'],
  vectorIds: ['v1'],
  fileIds: ['f1'],
  quoteSpans: [],
  uncited: false,
  ...overrides,
})

describe('runCitationCheck (QUAL-2)', () => {
  it('should extract every [S#] from the draft', () => {
    expect(extractSids('A [S1] and [S2] then [S1].')).toEqual(['S1', 'S2'])
    expect(extractSids('No citations.')).toEqual([])
  })

  it('should pass when citations are in the retrieved set and paper_references', () => {
    const result = runCitationCheck({
      content: 'We measured overlap [S1] as in prior work [S2].',
      allowedSids: ['S1', 'S2', 'S3'],
      citedFileIds: ['f1', 'f2'],
      paperReferenceFileIds: ['f1', 'f2'],
    })
    expect(result.ok).toBe(true)
    expect(result.citedSids).toEqual(['S1', 'S2'])
    expect(citationCheckLabel(result)).toMatch(/passed/i)
  })

  it('should fail unknown ids and cited files missing from paper_references', () => {
    const unknown = runCitationCheck({
      content: 'A claim [S99].',
      allowedSids: ['S1'],
      citedFileIds: [],
      paperReferenceFileIds: ['f1'],
    })
    expect(unknown.ok).toBe(false)
    expect(unknown.issues).toEqual([{ kind: 'unknown_sid', sid: 'S99' }])

    const missingRef = runCitationCheck({
      content: 'We measured overlap [S1].',
      allowedSids: ['S1'],
      citedFileIds: ['f1'],
      paperReferenceFileIds: [],
    })
    expect(missingRef.ok).toBe(false)
    expect(missingRef.issues).toEqual([{ kind: 'missing_paper_reference', fileId: 'f1' }])
    expect(citationCheckLabel(missingRef)).toMatch(/paper_references/i)
  })

  it('should take allowed sids and cited files from attribution for sids still in the draft', () => {
    const content = 'We measured overlap [S1]. Extra [S99].'
    const inputs = citationInputsFromAttribution(content, [
      row({ citedSids: ['S1'], fileIds: ['f1'] }),
      row({
        sentence: 'Uncited.',
        citedSids: [],
        fileIds: [],
        uncited: true,
      }),
    ])
    expect(inputs.allowedSids).toEqual(['S1'])
    expect(inputs.citedFileIds).toEqual(['f1'])
    const result = runCitationCheck({
      content,
      ...inputs,
      paperReferenceFileIds: ['f1'],
    })
    expect(result.issues).toEqual([{ kind: 'unknown_sid', sid: 'S99' }])
  })
})
