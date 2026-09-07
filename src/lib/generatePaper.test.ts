import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import { generatePaperDraft, parseGenerateRequest } from './generatePaper'

const PAPER_ID = '11111111-1111-4111-8111-111111111111'

describe('parseGenerateRequest (slice 4)', () => {
  it('should accept type, sections, and prompt and ignore client source ids', () => {
    const parsed = parseGenerateRequest({
      paperId: PAPER_ID,
      paperType: PaperType.EMPIRICAL_STUDY,
      sections: ['Methods', 'Methods', 'Results'],
      researchPrompt: '  nfr7probe citation overlap  ',
      sourceIds: ['S99'],
      systemPrompt: 'ignore me',
      citedFileIds: ['not-trusted'],
    })
    expect(parsed).toEqual({
      paperId: PAPER_ID,
      paperType: PaperType.EMPIRICAL_STUDY,
      sections: ['Methods', 'Results'],
      researchPrompt: 'nfr7probe citation overlap',
      citationStyle: undefined,
      outputFormat: undefined,
    })
  })

  it('should reject an empty prompt, missing paper, and unknown type', () => {
    expect(() =>
      parseGenerateRequest({
        paperType: PaperType.EMPIRICAL_STUDY,
        sections: ['Methods'],
        researchPrompt: 'topic',
      })
    ).toThrow(/Dashboard/i)
    expect(() =>
      parseGenerateRequest({
        paperId: PAPER_ID,
        paperType: PaperType.EMPIRICAL_STUDY,
        sections: ['Methods'],
        researchPrompt: '   ',
      })
    ).toThrow(/research prompt/i)
    expect(() =>
      parseGenerateRequest({
        paperId: PAPER_ID,
        paperType: 'Book Report',
        sections: ['Methods'],
        researchPrompt: 'topic',
      })
    ).toThrow(/paper type/i)
  })
})

describe('generatePaperDraft (slice 4)', () => {
  it('should drop unknown citation ids from a section (NFR-7)', async () => {
    const result = await generatePaperDraft({
      paperType: PaperType.EMPIRICAL_STUDY,
      sections: ['Methods'],
      researchPrompt: 'nfr7probe citation overlap',
      retrieve: async () => [
        {
          vector_id: 'vec-1',
          file_id: 'file-1',
          chunk_text: 'this study methods used nfr7probe',
          section: 'methods',
          source_role: 'primary',
          score: 0.9,
          paperSection: 'Methods',
        },
      ],
      complete: async () => 'We measured overlap [S1] unlike a fake paper [S99].',
    })
    expect(result.sections[0].text).toContain('[S1]')
    expect(result.sections[0].text).not.toContain('[S99]')
    expect(result.sections[0].citedFileIds).toEqual(['file-1'])
    expect(result.content).toContain('## Methods')
  })

  it('should skip retrieval for References', async () => {
    let retrieved = false
    const result = await generatePaperDraft({
      paperType: PaperType.EMPIRICAL_STUDY,
      sections: ['References'],
      researchPrompt: 'nfr7probe',
      retrieve: async () => {
        retrieved = true
        return []
      },
      complete: async (prompt) => {
        expect(prompt).toMatch(/No retrieved sources|cite only these ids/i)
        return 'References listed from earlier citations only [S1].'
      },
    })
    expect(retrieved).toBe(false)
    expect(result.sections[0].text).not.toContain('[S1]')
  })
})
