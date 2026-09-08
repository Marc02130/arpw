export type BibliographicRecord = {
  authors: string[]
  year: string | null
  title: string | null
  container: string | null
  volume: string | null
  issue?: string | null
  pages: string | null
  doi: string | null
  source?: 'crossref' | 'pubmed' | 'title-page'
}

export const emptyBibliographicRecord = (): BibliographicRecord => ({
  authors: [],
  year: null,
  title: null,
  container: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
})

const DOI_RE = /\b(10\.\d{4,9}\/[A-Z0-9._;()/:-]+)/i
const YEAR_RE = /\b((?:19|20)\d{2})\b/
const SKIP_LINE =
  /^(vol\.?:|https?:\/\/|doi:|received|accepted|published|revised|copyright|©|open access|this article is licensed|creative commons|purpose of review|send orders|www\.|edited by|reviewed by|specialty section|see |†these|licensee|academic editor|attribution|citation:|distributed under|licenses\/by)/i

const ACUTE: Record<string, string> = {
  a: 'á',
  c: 'ć',
  e: 'é',
  l: 'ĺ',
  n: 'ń',
  o: 'ó',
  s: 'ś',
  z: 'ź',
  A: 'Á',
  C: 'Ć',
  E: 'É',
  N: 'Ń',
  O: 'Ó',
  S: 'Ś',
  Z: 'Ź',
}

const OGONEK: Record<string, string> = { a: 'ą', e: 'ę', A: 'Ą', E: 'Ę' }

export const repairPdfDiacritics = (text: string): string =>
  text
    .replace(/https?:\/\/doi\.org\s*\/\s*/gi, 'https://doi.org/')
    .replace(/doi:\s*\n\s*/gi, 'doi: ')
    .replace(/\s*[\u00B4\u0301´]([nsczoaelNSCZOAEL])/g, (_, letter: string) => ACUTE[letter] ?? letter)
    .replace(/\s*[\u02DB\u0328]([aeAE])/g, (_, letter: string) => OGONEK[letter] ?? letter)
    .replace(/\s*[\u02D9\u0307]([zZ])/g, (_, letter: string) => (letter === 'z' ? 'ż' : 'Ż'))
    .normalize('NFC')

export const extractDoi = (text: string): string | null => {
  const match = repairPdfDiacritics(text).match(DOI_RE)
  if (!match) return null
  return match[1].replace(/[.,);]+$/g, '')
}

export const extractPmid = (text: string): string | null => {
  const repaired = repairPdfDiacritics(text)
  const fromUrl = repaired.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)
  if (fromUrl) return fromUrl[1]
  const fromLabel = repaired.match(/\bPMID:\s*(\d+)/i)
  return fromLabel?.[1] ?? null
}

const stripAffiliationDigits = (value: string): string =>
  value.replace(/\d+/g, ' ').replace(/[*†‡§,]+$/g, ' ').replace(/\s+/g, ' ').trim()

const alreadyApaAuthor = (value: string): boolean =>
  /^[\p{L}][\p{L}'’-]+,\s*\p{Lu}(?:[.\s-]*\p{Lu})*\.?$/u.test(value.trim())

const spaceInitials = (initials: string): string =>
  initials
    .replace(/\s+/g, '')
    .replace(/([A-Z])(?=[A-Z])/g, '$1.')
    .replace(/([A-Z])\.(?=[A-Z])/g, '$1. ')
    .replace(/([A-Z])$/, '$1.')
    .replace(/\s+/g, ' ')
    .trim()

export const apaInvertName = (fullName: string): string => {
  const cleaned = stripAffiliationDigits(fullName).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (alreadyApaAuthor(cleaned)) {
    const [family, rest] = cleaned.split(',').map((part) => part.trim())
    return `${family}, ${spaceInitials(rest.replace(/,/g, ' '))}`
  }
  const bits = cleaned.replace(/,/g, ' ').split(' ').filter(Boolean)
  if (bits.length === 1) return bits[0]
  const last = bits[bits.length - 1]
  const given = bits.slice(0, -1)
  const initials = given
    .map((part) => {
      if (part.includes('-')) {
        return part
          .split('-')
          .filter(Boolean)
          .map((piece) => `${piece[0].toUpperCase()}.`)
          .join('-')
      }
      if (/^[A-Z]\.?$/i.test(part) || /\./.test(part)) return spaceInitials(part)
      return `${part[0].toUpperCase()}.`
    })
    .join(' ')
  return `${last}, ${initials}`
}

export const formatAuthorListApa = (names: string[]): string => {
  const parts = names.map(apaInvertName).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]}, & ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, & ${parts[parts.length - 1]}`
}

const splitAuthorLine = (line: string): string[] => {
  const cleaned = line.replace(/\s+and\s+/gi, ', ')
  return cleaned
    .split(/\s*·\s*|,\s+/)
    .map((part) => stripAffiliationDigits(part).replace(/^and\s+/i, '').trim())
    .filter((part) => part.length >= 4 && /[\p{L}]/u.test(part) && !SKIP_LINE.test(part))
    .filter((part) => {
      const words = part.split(' ').length
      return words >= 2 && words <= 6
    })
}

const looksLikeAuthorLine = (line: string): boolean => {
  if (SKIP_LINE.test(line)) return false
  if (/received|accepted|published|doi|http|department|university|institute/i.test(line)) return false
  if (line.includes('·') && /\p{Lu}/u.test(line)) return true
  if (/\d/.test(line) && /\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){1,4}/u.test(line) && line.length < 220) {
    return true
  }
  if (/(?:\s+&\s+|,\s+)\p{Lu}/u.test(line) && line.length < 220) return true
  return false
}

const parseJournalYearVolume = (
  line: string
): Pick<BibliographicRecord, 'container' | 'year' | 'volume' | 'pages'> | null => {
  const springer = line.match(
    /^(.+?)\s*\(((?:19|20)\d{2})\)\s*(\d+)(?::(\d+(?:\s*[–-]\s*\d+)?))?/
  )
  if (springer) {
    return {
      container: springer[1].replace(/^Vol\.:\(\d+\)/i, '').trim(),
      year: springer[2],
      volume: springer[3],
      pages: springer[4] ? springer[4].replace(/\s+/g, '') : null,
    }
  }
  const comma = line.match(
    /^(.+?),\s*((?:19|20)\d{2}),\s*(\d+),\s*(\d+(?:\s*[–-]\s*\d+)?)/
  )
  if (comma) {
    return {
      container: comma[1].trim(),
      year: comma[2],
      volume: comma[3],
      pages: comma[4].replace(/\s+/g, ''),
    }
  }
  const mdpiTail = line.match(
    /^([A-Za-z][A-Za-z .&-]+?)\s+((?:19|20)\d{2}),\s*(\d+),\s*(\d+)\.?$/
  )
  if (mdpiTail) {
    return {
      container: mdpiTail[1].trim(),
      year: mdpiTail[2],
      volume: mdpiTail[3],
      pages: mdpiTail[4],
    }
  }
  return null
}

const sentenceCaseTitle = (title: string): string => {
  const trimmed = title
    .replace(/^Citation:\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*This article is an open access article.*$/i, '')
    .trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

const parseMdpiAuthors = (authorBlob: string): string[] =>
  authorBlob
    .split(';')
    .map((name) => name.replace(/^Citation:\s*/i, '').trim())
    .filter(Boolean)
    .map((name) => {
      if (alreadyApaAuthor(name)) return name.replace(/\s+/g, ' ')
      const [family, ...rest] = name.split(',').map((part) => part.trim())
      if (!rest.length) return family
      return `${family}, ${spaceInitials(rest.join(' '))}`
    })

const parseMdpiCitation = (text: string): BibliographicRecord | null => {
  const block = text.match(/Citation:\s*([\s\S]+?)(?:\nCopyright:|\nLicensee|\nThis article is an open access|\nReview\b|\nAcademic Editor:|$)/i)
  if (!block) return null
  const body = block[1].replace(/\s+/g, ' ').trim()
  const mdpi = body.match(
    /^(.+?)\.\s+(.+?)\.\s+([A-Za-z][A-Za-z .&-]+?)\s+((?:19|20)\d{2}),\s*(\d+),\s*(\d+)\./
  )
  if (!mdpi) return null
  const record = emptyBibliographicRecord()
  record.authors = parseMdpiAuthors(mdpi[1])
  record.title = sentenceCaseTitle(mdpi[2])
  record.container = mdpi[3].trim()
  record.year = mdpi[4]
  record.volume = mdpi[5]
  record.pages = mdpi[6]
  record.doi = extractDoi(text)
  return record
}

export const extractBibliographicRecord = (frontMatter: string): BibliographicRecord => {
  const text = repairPdfDiacritics(frontMatter.replace(/\r/g, ''))
  const mdpi = parseMdpiCitation(text)
  const record = mdpi ?? emptyBibliographicRecord()
  if (!record.doi) record.doi = extractDoi(text)

  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (const line of lines) {
    if (/^Citation:/i.test(line)) continue
    const journal = parseJournalYearVolume(line)
    if (journal?.container) {
      record.container = record.container ?? journal.container
      record.year = record.year ?? journal.year
      record.volume = record.volume ?? journal.volume
      record.pages = record.pages ?? journal.pages
    }
  }

  if (!record.year) {
    const published = text.match(/Published:\s*\d{1,2}\s+\w+\s+((?:19|20)\d{2})/i)
    const copyright = text.match(/©(?:\s*(?:The Author\(s\)|by the authors))?\s*((?:19|20)\d{2})/i)
    const anyYear = text.match(YEAR_RE)
    record.year = published?.[1] ?? copyright?.[1] ?? anyYear?.[1] ?? null
  }

  const titleParts: string[] = []
  let seenReview = false
  for (const line of lines) {
    if (/^Review$/i.test(line) || /^Article$/i.test(line)) {
      seenReview = true
      continue
    }
    if (!seenReview) continue
    if (SKIP_LINE.test(line)) continue
    if (looksLikeAuthorLine(line)) {
      if (record.authors.length === 0) record.authors = splitAuthorLine(line)
      break
    }
    if (line.length < 8) continue
    titleParts.push(line)
    if (titleParts.join(' ').length > 220) break
  }
  if (titleParts.length) record.title = sentenceCaseTitle(titleParts.join(' '))
  else if (record.title) record.title = sentenceCaseTitle(record.title)

  if (record.authors.length === 0) {
    const authorLine = lines.find((line) => looksLikeAuthorLine(line) && splitAuthorLine(line).length >= 1)
    if (authorLine) record.authors = splitAuthorLine(authorLine)
  }

  if (record.title && /citation:|open access article|academic editor/i.test(record.title)) {
    record.title = sentenceCaseTitle(
      record.title.replace(/^.*?Citation:\s*/i, '').replace(/\s*This article is an open access article.*$/i, '')
    )
  }

  return record
}

const doiUrl = (doi: string): string =>
  doi.startsWith('http') ? doi : `https://doi.org/${doi}`

export const hasUsableBibliographicRecord = (record: BibliographicRecord): boolean =>
  Boolean(record.title || record.doi || (record.authors.length && record.year))

export const formatBibliographicCitation = (
  record: BibliographicRecord,
  style: string
): string | null => {
  if (!hasUsableBibliographicRecord(record)) return null
  const year = record.year ?? 'n.d.'
  const title = record.title ? sentenceCaseTitle(record.title) : 'Untitled work'
  const doi = record.doi ? doiUrl(record.doi) : ''
  const authorsApa = formatAuthorListApa(record.authors)
  const journal = record.container
  const vol = record.volume
  const pages = record.pages

  if (style === 'MLA') {
    const authors =
      record.authors.length === 0
        ? ''
        : record.authors.length === 1
          ? record.authors[0]
          : `${record.authors[0]}, et al.`
    const journalBit = journal ? ` *${journal}*` : ''
    const volBit = vol ? `, vol. ${vol}` : ''
    const pageBit = pages ? `, pp. ${pages}` : ''
    return `${authors ? `${authors}. ` : ''}"${title}."${journalBit}${volBit}, ${year}${pageBit}.${doi ? ` ${doi}.` : ''}`
      .replace(/\s+/g, ' ')
      .trim()
  }

  if (style === 'Chicago') {
    const authors = record.authors.length ? `${record.authors.join(', ')}. ` : ''
    const journalBit = journal ? ` *${journal}*` : ''
    const volBit = vol ? ` ${vol}` : ''
    const pageBit = pages ? `: ${pages}` : ''
    return `${authors}"${title}."${journalBit}${volBit} (${year})${pageBit}.${doi ? ` ${doi}.` : ''}`
      .replace(/\s+/g, ' ')
      .trim()
  }

  const who = authorsApa ? `${authorsApa} ` : ''
  const issue = record.issue
  const journalBit = journal
    ? issue && vol
      ? ` *${journal}, ${vol}*(${issue})`
      : ` *${journal}${vol ? `, ${vol}` : ''}*`
    : ''
  const pageBit = pages ? `, ${pages}` : ''
  return `${who}(${year}). ${title}.${journalBit}${pageBit}.${doi ? ` ${doi}` : ''}`
    .replace(/\s+\./g, '.')
    .replace(/\s+/g, ' ')
    .trim()
}
