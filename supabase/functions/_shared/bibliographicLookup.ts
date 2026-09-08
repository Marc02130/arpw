import {
  emptyBibliographicRecord,
  extractDoi,
  extractPmid,
  hasUsableBibliographicRecord,
  type BibliographicRecord,
} from './bibliographicCitation.ts'

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

const CROSSREF_UA = 'ARPW/1.0 (https://github.com/Marc02130/arpw; mailto:research@localhost)'

const givenToInitials = (given: string): string =>
  given
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.includes('-')) {
        return part
          .split('-')
          .filter(Boolean)
          .map((piece) => `${piece[0].toUpperCase()}.`)
          .join('-')
      }
      return `${part[0].toUpperCase()}.`
    })
    .join(' ')

export const recordFromCrossrefWork = (work: Record<string, unknown>): BibliographicRecord => {
  const authors = Array.isArray(work.author)
    ? work.author
        .map((row) => {
          if (!row || typeof row !== 'object') return ''
          const rec = row as { family?: unknown; given?: unknown }
          const family = typeof rec.family === 'string' ? rec.family.trim() : ''
          const given = typeof rec.given === 'string' ? rec.given.trim() : ''
          if (!family) return given
          if (!given) return family
          return `${family}, ${givenToInitials(given)}`
        })
        .filter(Boolean)
    : []
  const title = Array.isArray(work.title) ? String(work.title[0] ?? '') : ''
  const container = Array.isArray(work['container-title'])
    ? String(work['container-title'][0] ?? '')
    : ''
  const issued = work.issued as { 'date-parts'?: number[][] } | undefined
  const year = issued?.['date-parts']?.[0]?.[0]
  return {
    authors,
    year: year ? String(year) : null,
    title: title || null,
    container: container || null,
    volume: typeof work.volume === 'string' ? work.volume : null,
    issue: typeof work.issue === 'string' ? work.issue : null,
    pages: typeof work.page === 'string' ? work.page : null,
    doi: typeof work.DOI === 'string' ? work.DOI.toLowerCase() : null,
    source: 'crossref',
  }
}

const recordFromPubmedSummary = (doc: Record<string, unknown>): BibliographicRecord => {
  const authors = Array.isArray(doc.authors)
    ? doc.authors
        .map((row) => {
          if (!row || typeof row !== 'object') return ''
          const name = (row as { name?: unknown }).name
          return typeof name === 'string' ? name.trim() : ''
        })
        .filter(Boolean)
        .map((name) => {
          const match = name.match(/^(.+?)\s+([A-Z]{1,3})$/)
          if (!match) return name
          return `${match[1]}, ${match[2].split('').join('. ')}.`
        })
    : []
  const pubdate = typeof doc.pubdate === 'string' ? doc.pubdate : ''
  const year = pubdate.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? null
  const elocation = typeof doc.elocationid === 'string' ? doc.elocationid : ''
  const doiMatch = elocation.match(/10\.\d{4,9}\/[^\s]+/i)
  return {
    authors,
    year,
    title: typeof doc.title === 'string' ? doc.title : null,
    container: typeof doc.source === 'string' ? doc.source : null,
    volume: typeof doc.volume === 'string' ? doc.volume : null,
    issue: typeof doc.issue === 'string' ? doc.issue : null,
    pages: typeof doc.pages === 'string' ? doc.pages : null,
    doi: doiMatch ? doiMatch[0].replace(/[.;]+$/, '') : null,
    source: 'pubmed',
  }
}

export const fetchCrossrefWork = async (
  doi: string,
  fetchImpl: FetchLike
): Promise<BibliographicRecord | null> => {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': CROSSREF_UA },
  })
  if (!res.ok) return null
  const body = (await res.json()) as { message?: Record<string, unknown> }
  if (!body.message) return null
  const record = recordFromCrossrefWork(body.message)
  return hasUsableBibliographicRecord(record) ? record : null
}

export const fetchPubmedSummary = async (
  pmid: string,
  fetchImpl: FetchLike
): Promise<BibliographicRecord | null> => {
  const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${encodeURIComponent(pmid)}`
  const sumRes = await fetchImpl(sumUrl)
  if (!sumRes.ok) return null
  const sumBody = (await sumRes.json()) as { result?: Record<string, unknown> }
  const doc = sumBody.result?.[pmid]
  if (!doc || typeof doc !== 'object') return null
  const record = recordFromPubmedSummary(doc as Record<string, unknown>)
  return hasUsableBibliographicRecord(record) ? record : null
}

export const fetchPubmedByDoi = async (
  doi: string,
  fetchImpl: FetchLike
): Promise<BibliographicRecord | null> => {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(`${doi}[doi]`)}`
  const searchRes = await fetchImpl(searchUrl)
  if (!searchRes.ok) return null
  const searchBody = (await searchRes.json()) as {
    esearchresult?: { idlist?: string[] }
  }
  const pmid = searchBody.esearchresult?.idlist?.[0]
  if (!pmid) return null
  const record = await fetchPubmedSummary(pmid, fetchImpl)
  if (record && !record.doi) record.doi = doi
  return record
}

export const lookupBibliographicRecord = async (
  frontMatter: string,
  fetchImpl: FetchLike
): Promise<BibliographicRecord> => {
  const doi = extractDoi(frontMatter)
  const pmid = extractPmid(frontMatter)
  if (doi) {
    try {
      const fromCrossref = await fetchCrossrefWork(doi, fetchImpl)
      if (fromCrossref) return fromCrossref
    } catch {
      /* try PubMed */
    }
    try {
      const fromPubmed = await fetchPubmedByDoi(doi, fetchImpl)
      if (fromPubmed) return fromPubmed
    } catch {
      /* try PMID */
    }
  }
  if (pmid) {
    try {
      const fromPubmed = await fetchPubmedSummary(pmid, fetchImpl)
      if (fromPubmed?.doi) {
        try {
          const fromCrossref = await fetchCrossrefWork(fromPubmed.doi, fetchImpl)
          if (fromCrossref) return fromCrossref
        } catch {
          /* use PubMed */
        }
      }
      if (fromPubmed) return fromPubmed
    } catch {
      /* leave empty */
    }
  }
  return emptyBibliographicRecord()
}

export const isCatalogRecord = (record: BibliographicRecord | null | undefined): boolean =>
  record?.source === 'crossref' || record?.source === 'pubmed'
