import { describe, expect, it } from 'vitest'
import {
  citedSids,
  fileIdsForSids,
  formatSourcesForPrompt,
  numberSources,
  stripUnknownCitations,
} from './citations'

describe('citation allow-list (slice 4 / NFR-7)', () => {
  const sources = numberSources([
    { vector_id: 'v1', file_id: 'f1', chunk_text: 'methods of the nfr7probe study' },
    { vector_id: 'v2', file_id: 'f2', chunk_text: 'published prior work' },
  ])
  const allowed = new Set(sources.map((source) => source.sid))

  it('should number sources as S1, S2', () => {
    expect(sources.map((source) => source.sid)).toEqual(['S1', 'S2'])
    expect(formatSourcesForPrompt(sources)).toContain('[S1]')
    expect(formatSourcesForPrompt(sources)).toContain('nfr7probe')
  })

  it('should drop unknown citation ids and keep allowed ones', () => {
    const raw = 'We found overlap [S1] unlike Smith [S99] and also [S2].'
    const cleaned = stripUnknownCitations(raw, allowed)
    expect(cleaned).toContain('[S1]')
    expect(cleaned).toContain('[S2]')
    expect(cleaned).not.toContain('[S99]')
    expect(citedSids(cleaned, allowed)).toEqual(['S1', 'S2'])
    expect(fileIdsForSids(['S1', 'S2'], sources).sort()).toEqual(['f1', 'f2'])
  })

  it('should refuse a draft that only cites unknown ids', () => {
    const cleaned = stripUnknownCitations('A claim [S99] and [S100].', allowed)
    expect(cleaned).not.toMatch(/\[S\d+\]/)
    expect(citedSids(cleaned, allowed)).toEqual([])
  })
})
