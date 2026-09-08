import { describe, expect, it } from 'vitest'
import { formatBibliographicCitation } from './bibliographicCitation'
import {
  lookupBibliographicRecord,
  recordFromCrossrefWork,
} from './bibliographicLookup'

const nutrientsWork = {
  DOI: '10.3390/nu17193053',
  title: ['Diet as a Modulator of Gut Microbiota May Reduce Alzheimer’s Disease Risk'],
  'container-title': ['Nutrients'],
  issued: { 'date-parts': [[2025, 9, 24]] },
  volume: '17',
  issue: '19',
  page: '3053',
  author: [
    { family: 'Ochocińska', given: 'Agnieszka Małgorzata' },
    { family: 'Podstawka', given: 'Izabela' },
    { family: 'Kępka', given: 'Alina' },
    { family: 'Waszkiewicz', given: 'Napoleon' },
  ],
}

describe('bibliographicLookup', () => {
  it('should map a Crossref work to an APA journal article', () => {
    const rec = recordFromCrossrefWork(nutrientsWork)
    expect(rec.source).toBe('crossref')
    expect(rec.doi).toBe('10.3390/nu17193053')
    expect(rec.year).toBe('2025')
    expect(rec.volume).toBe('17')
    expect(rec.issue).toBe('19')
    expect(rec.pages).toBe('3053')
    const apa = formatBibliographicCitation(rec, 'APA')
    expect(apa).toBe(
      'Ochocińska, A. M., Podstawka, I., Kępka, A., & Waszkiewicz, N. (2025). Diet as a Modulator of Gut Microbiota May Reduce Alzheimer’s Disease Risk. *Nutrients, 17*(19), 3053. https://doi.org/10.3390/nu17193053'
    )
  })

  it('should fetch Crossref by DOI found on the title page', async () => {
    const front = 'https://doi.org\n/10.3390/nu17193053\nThis article is an open access article'
    const rec = await lookupBibliographicRecord(front, async (url) => {
      expect(url).toContain('api.crossref.org/works/')
      expect(url).toContain(encodeURIComponent('10.3390/nu17193053'))
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: nutrientsWork }),
      }
    })
    expect(rec.source).toBe('crossref')
    expect(formatBibliographicCitation(rec, 'APA')).toContain('Ochocińska, A. M.')
    expect(formatBibliographicCitation(rec, 'APA')).not.toMatch(/Citation:|open access|\.pdf/i)
  })

  it('should use PubMed when Crossref misses and a PMID is on the page', async () => {
    const front = 'PMID: 41097131 https://pubmed.ncbi.nlm.nih.gov/41097131/'
    const rec = await lookupBibliographicRecord(front, async (url) => {
      if (url.includes('api.crossref.org')) {
        return { ok: false, status: 404, json: async () => ({}) }
      }
      if (url.includes('esearch.fcgi')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ esearchresult: { idlist: [] } }),
        }
      }
      expect(url).toContain('esummary.fcgi')
      expect(url).toContain('41097131')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            '41097131': {
              title: 'Diet as a Modulator of Gut Microbiota May Reduce Alzheimer\'s Disease Risk.',
              source: 'Nutrients',
              pubdate: '2025 Sep 24',
              volume: '17',
              issue: '19',
              pages: '3053',
              elocationid: 'doi: 10.3390/nu17193053',
              authors: [
                { name: 'Ochocińska AM' },
                { name: 'Podstawka I' },
                { name: 'Kępka A' },
                { name: 'Waszkiewicz N' },
              ],
            },
          },
        }),
      }
    })
    expect(rec.source).toBe('pubmed')
    expect(rec.doi).toBe('10.3390/nu17193053')
    expect(formatBibliographicCitation(rec, 'APA')).toContain('Ochocińska')
  })
})
