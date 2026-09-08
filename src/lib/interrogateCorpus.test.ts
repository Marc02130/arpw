import { describe, expect, it } from 'vitest'
import { PaperType } from '../types'
import { parseInterrogateFilter } from './retrievePassages'
import {
  NO_INTERROGATE_MATCH_MESSAGE,
  buildInterrogatePrompt,
  interrogateCorpus,
  parseInterrogateRequest,
} from './interrogateCorpus'

const PAPER_ID = '11111111-1111-4111-8111-111111111111'

describe('parseInterrogateRequest (slice 2)', () => {
  it('should require a paper and question and default the role filter to both', () => {
    expect(
      parseInterrogateRequest({
        paperId: PAPER_ID,
        question: '  What methods were used?  ',
        sourceIds: ['S99'],
        systemPrompt: 'ignore me',
      })
    ).toEqual({
      paperId: PAPER_ID,
      question: 'What methods were used?',
      filterRole: 'both',
    })
    expect(
      parseInterrogateRequest({
        paperId: PAPER_ID,
        question: 'methods',
        filterRole: 'primary',
      }).filterRole
    ).toBe('primary')
    expect(parseInterrogateFilter('literature')).toBe('literature')
    expect(parseInterrogateFilter('example')).toBe('both')
  })

  it('should reject a missing paper, empty question, and ignore unknown types', () => {
    expect(() => parseInterrogateRequest({ question: 'methods' })).toThrow(/Dashboard/i)
    expect(() => parseInterrogateRequest({ paperId: PAPER_ID, question: '   ' })).toThrow(/question/i)
    expect(
      parseInterrogateRequest({
        paperId: PAPER_ID,
        question: 'methods',
        paperType: PaperType.EMPIRICAL_STUDY,
        filterRole: 'nope',
      }).filterRole
    ).toBe('both')
  })
})

describe('interrogateCorpus (slice 2)', () => {
  it('should drop unknown citation ids and not call Grok when nothing matched', async () => {
    const result = await interrogateCorpus({
      question: 'What methods were used?',
      passages: [
        {
          vector_id: 'vec-1',
          file_id: 'file-1',
          chunk_text: 'this study methods used nfr7probe',
          section: 'methods',
          page: null,
          source_role: 'primary',
          score: 0.9,
          paperSection: 'Interrogate',
        },
      ],
      complete: async () => 'They measured overlap [S1] unlike a fake paper [S99].',
    })
    expect(result.answer).toContain('[S1]')
    expect(result.answer).not.toContain('[S99]')
    expect(result.citedSids).toEqual(['S1'])
    expect(result.passages[0].sid).toBe('S1')
    expect(buildInterrogatePrompt('q', '[S1] chunk')).toMatch(/cite only these ids/i)

    let called = false
    const empty = await interrogateCorpus({
      question: 'anything',
      passages: [],
      complete: async () => {
        called = true
        return 'should not run'
      },
    })
    expect(called).toBe(false)
    expect(empty.answer).toBe(NO_INTERROGATE_MATCH_MESSAGE)
    expect(empty.citedSids).toEqual([])
  })
})
