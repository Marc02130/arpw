import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import {
  PAPER_SECTIONS,
  buildGenerationPrompt,
  buildRetrievalQuery,
  getSectionTemplate,
} from './generationTemplates'

describe('generationTemplates (slice 2)', () => {
  it('should cover every paper type and section', () => {
    for (const paperType of Object.values(PaperType)) {
      for (const section of PAPER_SECTIONS) {
        const template = getSectionTemplate(paperType, section)
        expect(template.instructions.length).toBeGreaterThan(20)
        expect(['literature', 'primary', 'both', 'none']).toContain(template.preferredSourceRole)
      }
    }
  })

  it('should use different prompts for empirical methods and literature-review introduction', () => {
    const methods = getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'Methods')
    const intro = getSectionTemplate(PaperType.LITERATURE_REVIEW, 'Introduction')
    expect(methods.retrievalQuery).not.toBe(intro.retrievalQuery)
    expect(methods.instructions).not.toBe(intro.instructions)
    expect(methods.preferredSourceRole).toBe('primary')
    expect(intro.preferredSourceRole).toBe('literature')
    expect(methods.instructions.toLowerCase()).toMatch(/this empirical study|primary/)
    expect(intro.instructions.toLowerCase()).toMatch(/literature review/)
    expect(intro.instructions.toLowerCase()).not.toMatch(/lab experiment/)
  })

  it('should force literature-only retrieval for a literature-review paper', () => {
    expect(getSectionTemplate(PaperType.LITERATURE_REVIEW, 'Methods').preferredSourceRole).toBe(
      'literature'
    )
    expect(getSectionTemplate(PaperType.LITERATURE_REVIEW, 'Results').preferredSourceRole).toBe(
      'literature'
    )
    expect(getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'Methods').preferredSourceRole).toBe('primary')
    expect(getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'Discussion').preferredSourceRole).toBe('both')
    expect(getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'References').preferredSourceRole).toBe('none')
  })

  it('should fold the research prompt into retrieval and generation text', () => {
    const topic = 'Does nfr7probe predict citation overlap?'
    const retrieval = buildRetrievalQuery(PaperType.EMPIRICAL_STUDY, 'Methods', topic)
    const generation = buildGenerationPrompt(PaperType.EMPIRICAL_STUDY, 'Methods', topic)
    expect(retrieval).toContain(topic)
    expect(retrieval).toMatch(/this study methods/i)
    expect(generation).toContain(topic)
    expect(generation).toContain('Research prompt:')
    expect(generation).toContain(getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'Methods').instructions)
  })

  it('should reject unknown sections and not take a user system prompt', () => {
    expect(() => getSectionTemplate(PaperType.EMPIRICAL_STUDY, 'Appendix')).toThrow(/Unknown paper section/)
    expect(buildGenerationPrompt.length).toBe(3)
    expect(buildRetrievalQuery.length).toBe(3)
  })
})
