import { describe, expect, it } from 'vitest'
import {
  formatCheckLabel,
  markdownSectionHeadings,
  runFormatCheck,
  sectionHeadingPresent,
} from './formatCheck'

const DRAFT = `## Abstract

A short abstract.

## Methods

We measured overlap [S1].

## Results

Twelve participants.
`

describe('runFormatCheck (QUAL-3)', () => {
  it('should read ## and ### headings', () => {
    expect(markdownSectionHeadings(DRAFT)).toEqual(['Abstract', 'Methods', 'Results'])
    expect(sectionHeadingPresent(DRAFT, 'Methods')).toBe(true)
    expect(sectionHeadingPresent('# Methods\nin a title', 'Methods')).toBe(false)
  })

  it('should pass when every required section heading is present', () => {
    const result = runFormatCheck({
      content: DRAFT,
      requiredSections: ['Abstract', 'Methods', 'Results'],
    })
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
    expect(formatCheckLabel(result)).toMatch(/passed/i)
  })

  it('should fail listing missing required sections', () => {
    const result = runFormatCheck({
      content: DRAFT,
      requiredSections: ['Abstract', 'Methods', 'Discussion', 'Conclusion'],
    })
    expect(result.ok).toBe(false)
    expect(result.present).toEqual(['Abstract', 'Methods'])
    expect(result.missing).toEqual(['Discussion', 'Conclusion'])
    expect(formatCheckLabel(result)).toBe('Format check failed: missing Discussion, Conclusion.')
  })
})
