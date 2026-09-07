import { describe, expect, it } from 'vitest'
import { NFR7_PROBE } from './nfr7Fixture'
import { attributeSentences, splitSentences, uncitedSentences } from './attribution'
import { numberSources } from './citations'

describe('attribution (QUAL-1)', () => {
  const sources = numberSources([
    {
      vector_id: 'vec-1',
      file_id: 'file-1',
      chunk_text: `A retrieval hit on ${NFR7_PROBE} must return a chunk from this fixture.`,
    },
    {
      vector_id: 'vec-2',
      file_id: 'file-2',
      chunk_text: 'published prior work on citation overlap',
    },
  ])

  it('should split prose into sentences', () => {
    expect(splitSentences('First claim. Second claim! Third?')).toEqual([
      'First claim.',
      'Second claim!',
      'Third?',
    ])
  })

  it('should map a cited sentence to chunk id and leave unknown ids already stripped', () => {
    const rows = attributeSentences(
      `We found overlap [S1]. A second claim has no source.`,
      'Methods',
      sources
    )
    expect(rows[0].uncited).toBe(false)
    expect(rows[0].citedSids).toEqual(['S1'])
    expect(rows[0].vectorIds).toEqual(['vec-1'])
    expect(rows[0].fileIds).toEqual(['file-1'])
    expect(rows[1].uncited).toBe(true)
    expect(uncitedSentences(rows).map((row) => row.sentence)).toEqual([
      'A second claim has no source.',
    ])
  })

  it('should map a quoted span to the fixture chunk even without an [S#]', () => {
    const quote = `A retrieval hit on ${NFR7_PROBE} must return a chunk from this fixture.`
    const rows = attributeSentences(`The protocol says "${quote}".`, 'Methods', sources)
    expect(rows[0].uncited).toBe(false)
    expect(rows[0].citedSids).toEqual(['S1'])
    expect(rows[0].quoteSpans).toEqual([{ sid: 'S1', quote }])
    expect(rows[0].vectorIds).toEqual(['vec-1'])
  })
})
