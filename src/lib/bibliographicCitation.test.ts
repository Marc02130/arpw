import { describe, expect, it } from 'vitest'
import {
  apaInvertName,
  extractBibliographicRecord,
  extractDoi,
  formatAuthorListApa,
  formatBibliographicCitation,
} from './bibliographicCitation'

describe('bibliographicCitation', () => {
  const springer = [
    'Vol.:(0123456789)Molecular Neurobiology (2026) 63:623',
    'https://doi.org/10.1007/s12035-026-05914-9',
    'REVIEW',
    'Gut Microbiota Dysbiosis and Neuroinflammation in Alzheimer’s',
    'Disease: a Systematic Review of Mechanistic Insights',
    'Sofia Katsigianni1 · Effrosyni Koutsouraki1',
    'Received: 9 June 2025 / Accepted: 4 May 2026',
    '© The Author(s) 2026',
  ].join('\n')

  it('should invert names for APA', () => {
    expect(apaInvertName('Sofia Katsigianni')).toBe('Katsigianni, S.')
    expect(apaInvertName('John F. Cryan')).toBe('Cryan, J. F.')
    expect(apaInvertName('Shih-Cheng Wu')).toBe('Wu, S.-C.')
    expect(formatAuthorListApa(['Sofia Katsigianni', 'Effrosyni Koutsouraki'])).toBe(
      'Katsigianni, S., & Koutsouraki, E.'
    )
  })

  it('should extract DOI, journal, year, title, and authors from a Springer first page', () => {
    expect(extractDoi(springer)).toBe('10.1007/s12035-026-05914-9')
    const rec = extractBibliographicRecord(springer)
    expect(rec.doi).toBe('10.1007/s12035-026-05914-9')
    expect(rec.year).toBe('2026')
    expect(rec.container).toMatch(/Molecular Neurobiology/i)
    expect(rec.volume).toBe('63')
    expect(rec.pages).toBe('623')
    expect(rec.title).toMatch(/Gut microbiota dysbiosis/i)
    expect(rec.authors.join(' ')).toMatch(/Katsigianni/i)
    expect(rec.authors.join(' ')).toMatch(/Koutsouraki/i)
  })

  it('should format an APA journal article without using the filename', () => {
    const rec = extractBibliographicRecord(springer)
    const apa = formatBibliographicCitation(rec, 'APA')
    expect(apa).toContain('Katsigianni, S.')
    expect(apa).toContain('(2026)')
    expect(apa).toMatch(/Molecular Neurobiology/)
    expect(apa).toContain('https://doi.org/10.1007/s12035-026-05914-9')
    expect(apa).not.toMatch(/\.pdf/i)
    expect(formatBibliographicCitation(emptyUnused(), 'APA')).toBeNull()
  })

  it('should repair PDF-split Polish diacritics and format the Nutrients cite', () => {
    const nutrients = [
      'Academic Editor: Livia Hecke Morais',
      'Received: 28 August 2025',
      'Published: 24 September 2025',
      'Citation: Ochoci ´nska, A.M.;',
      'Podstawka, I.; K˛epka, A.;',
      'Waszkiewicz, N. Diet as a Modulator',
      'of Gut Microbiota May Reduce',
      'Alzheimer’s Disease Risk. Nutrients',
      '2025, 17, 3053. https://doi.org',
      '/10.3390/nu17193053',
      'Copyright: © 2025 by the authors.',
      'This article is an open access article',
      'distributed under the terms and',
      'Review',
      'Diet as a Modulator of Gut Microbiota May Reduce Alzheimer’s',
      'Disease Risk',
      'Agnieszka Małgorzata Ochoci ´nska 1,* , Izabela Podstawka 1, Alina K˛epka 1,† and Napoleon Waszkiewicz 2,†',
    ].join('\n')
    const rec = extractBibliographicRecord(nutrients)
    expect(rec.authors.join(' ')).toMatch(/Ochocińska|Ochocinska/)
    expect(rec.authors.join(' ')).not.toMatch(/´nska/)
    expect(rec.authors.some((name) => /Kępka|Kepka/.test(name))).toBe(true)
    expect(rec.title).toMatch(/Diet as a modulator of gut microbiota/i)
    expect(rec.title).not.toMatch(/Citation:|open access/i)
    expect(rec.container).toMatch(/Nutrients/i)
    expect(rec.year).toBe('2025')
    expect(rec.volume).toBe('17')
    expect(rec.pages).toBe('3053')
    expect(rec.doi).toBe('10.3390/nu17193053')
    const apa = formatBibliographicCitation(rec, 'APA')
    expect(apa).toMatch(/Ochocińska, A\. M\./)
    expect(apa).toContain('(2025)')
    expect(apa).toContain('https://doi.org/10.3390/nu17193053')
    expect(apa).not.toMatch(/Citation:/)
    expect(apa).not.toMatch(/open access/i)
    expect(apa).not.toMatch(/doi\.org \//)
  })

  it('should not invert names that are already Family, Initials', () => {
    expect(apaInvertName('Ochocińska, A.M.')).toBe('Ochocińska, A. M.')
    expect(apaInvertName('Podstawka, I.')).toBe('Podstawka, I.')
  })

  it('should read an MDPI Citation line when present', () => {
    const mdpi = [
      'Citation: Cutuli, D.; Decandia, D.; Giacovazzo, G.; Coccurello, R.',
      'Physical Exercise as Disease-Modifying Alternative against Alzheimer’s Disease: A Gut–Muscle–Brain Partnership. Int. J.',
      'Mol. Sci. 2023, 24, 14686. https://doi.org/10.3390/ijms241914686',
    ].join('\n')
    const rec = extractBibliographicRecord(mdpi)
    expect(rec.year).toBe('2023')
    expect(rec.doi).toBe('10.3390/ijms241914686')
    expect(rec.container).toMatch(/Mol\. Sci/i)
    expect(rec.authors[0]).toMatch(/Cutuli/i)
  })
})

function emptyUnused() {
  return {
    authors: [] as string[],
    year: null,
    title: null,
    container: null,
    volume: null,
    issue: null,
    pages: null,
    doi: null,
  }
}
