import { describe, expect, it } from 'vitest'
import {
  citedSids,
  EMPTY_REFERENCES,
  fileIdsForSids,
  formatReferencesList,
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

  it('should prefer a stored preformatted citation over a rebuilt record', () => {
    const text = formatReferencesList(
      [
        {
          file_id: 'a',
          file_name: 'nutrients-17-03053.pdf',
          citation_text:
            'Ochocińska AM, Podstawka I, Kępka A, Waszkiewicz N. Diet as a Modulator of Gut Microbiota May Reduce Alzheimer\'s Disease Risk. Nutrients. 2025 Sep 24;17(19):3053. doi: 10.3390/nu17193053.',
        },
      ],
      'APA'
    )
    expect(text).toContain('Ochocińska AM')
    expect(text).toContain('doi: 10.3390/nu17193053')
    expect(text).not.toMatch(/nutrients-17-03053\.pdf/)
  })

  it('should format References as academic citations, not filenames', () => {
    expect(formatReferencesList([])).toBe(EMPTY_REFERENCES)
    const text = formatReferencesList(
      [
        {
          file_id: 'a',
          file_name: 'aging-12-102930.pdf',
          bibliographic: {
            authors: ['Sofia Katsigianni', 'Effrosyni Koutsouraki'],
            year: '2026',
            title: 'Gut microbiota dysbiosis and neuroinflammation in Alzheimer’s disease',
            container: 'Molecular Neurobiology',
            volume: '63',
            pages: '623',
            doi: '10.1007/s12035-026-05914-9',
          },
        },
      ],
      'APA'
    )
    expect(text).toContain('Katsigianni, S.')
    expect(text).toContain('(2026)')
    expect(text).toContain('Molecular Neurobiology')
    expect(text).not.toMatch(/aging-12-102930\.pdf/)
    expect(
      formatReferencesList([{ file_id: 'x', file_name: 'mystery.pdf' }], 'APA')
    ).toMatch(/DOI\/PMID catalog record/i)
  })
})
