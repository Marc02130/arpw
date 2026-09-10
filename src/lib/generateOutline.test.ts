import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import { generateOutlineDraft, parseOutlineRequest } from './generateOutline'

const PAPER_ID = '11111111-1111-4111-8111-111111111111'

describe('parseOutlineRequest (GEN-8)', () => {
  it('should accept type, sections, and prompt and ignore client source ids', () => {
    const parsed = parseOutlineRequest({
      paperId: PAPER_ID,
      paperType: PaperType.LITERATURE_REVIEW,
      sections: ['Abstract', 'Introduction', 'References'],
      researchPrompt: '  gut-brain axis  ',
      sourceIds: ['S99'],
      systemPrompt: 'ignore me',
    })
    expect(parsed).toEqual({
      paperId: PAPER_ID,
      paperType: PaperType.LITERATURE_REVIEW,
      sections: ['Abstract', 'Introduction', 'References'],
      researchPrompt: 'gut-brain axis',
    })
  })

  it('should reject empty prompt, missing paper, and References-only', () => {
    expect(() =>
      parseOutlineRequest({
        paperType: PaperType.LITERATURE_REVIEW,
        sections: ['Introduction'],
        researchPrompt: 'topic',
      })
    ).toThrow(/Dashboard/i)
    expect(() =>
      parseOutlineRequest({
        paperId: PAPER_ID,
        paperType: PaperType.LITERATURE_REVIEW,
        sections: ['Introduction'],
        researchPrompt: '   ',
      })
    ).toThrow(/research prompt/i)
    expect(() =>
      parseOutlineRequest({
        paperId: PAPER_ID,
        paperType: PaperType.LITERATURE_REVIEW,
        sections: ['References'],
        researchPrompt: 'topic',
      })
    ).toThrow(/References/i)
  })
})

describe('generateOutlineDraft (GEN-8)', () => {
  it('should drop unknown citation ids from the outline', async () => {
    const result = await generateOutlineDraft({
      paperType: PaperType.LITERATURE_REVIEW,
      sections: ['Introduction', 'Literature Review'],
      researchPrompt: 'gut-brain axis',
      retrieve: async () => [
        {
          vector_id: 'vec-1',
          file_id: 'file-1',
          chunk_text: 'omega-3 and cognition',
          section: 'discussion',
          page: 1,
          source_role: 'literature',
          score: 0.9,
          paperSection: 'Introduction',
        },
      ],
      complete: async (prompt) => {
        expect(prompt).toContain('## Introduction')
        expect(prompt).toContain('[S1]')
        return '## Introduction\n- Omega-3 [S1]\n- Fake trial [S99]\n'
      },
    })
    expect(result.outline).toContain('[S1]')
    expect(result.outline).not.toContain('[S99]')
  })
})
