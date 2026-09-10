import { describe, expect, it } from 'vitest'
import { buildOutlinePrompt, firstContentSection, outlineForSection } from './outline'

const SAMPLE = `## Abstract
- One-sentence claim [S1]

## Introduction
- Gap in prior work [S2]
- Why this review

## Literature Review
- Microbiome [S3]
`

describe('outline helpers (GEN-8)', () => {
  it('should skip References when picking the retrieve section', () => {
    expect(firstContentSection(['References'])).toBeNull()
    expect(firstContentSection(['References', 'Introduction'])).toBe('Introduction')
    expect(firstContentSection(['Abstract', 'Introduction'])).toBe('Abstract')
  })

  it('should extract a section block and fall back to the full outline', () => {
    expect(outlineForSection('', 'Introduction')).toBe('')
    expect(outlineForSection(SAMPLE, 'Introduction')).toBe(
      '## Introduction\n- Gap in prior work [S2]\n- Why this review'
    )
    expect(outlineForSection(SAMPLE, 'Discussion')).toBe(SAMPLE.trim())
  })

  it('should list selected headings in the outline prompt', () => {
    const prompt = buildOutlinePrompt(
      'Literature Review',
      ['Abstract', 'Introduction', 'References'],
      'gut-brain axis',
      '[S1] omega-3'
    )
    expect(prompt).toContain('## Abstract')
    expect(prompt).toContain('## Introduction')
    expect(prompt).not.toContain('## References')
    expect(prompt).toContain('gut-brain axis')
    expect(prompt).toContain('[S1] omega-3')
  })
})
