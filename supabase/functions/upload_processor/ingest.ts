export const INGEST_EXTENSIONS = ['pdf', 'docx', 'txt'] as const
export const MAX_INGEST_BYTES = 10 * 1024 * 1024
export const EMBEDDING_DIMS = 384
export const CHUNK_SIZE = 1000
export const CHUNK_OVERLAP = 200
export const MIN_CHUNK_CHARS = 50
export const EMBEDDING_MODEL = 'hash-384'

export type IngestDocumentType = 'reference' | 'example'

export type StorageTarget = {
  bucket: 'references' | 'examples'
  key: string
}

export const UNKNOWN_SECTION = 'Unknown'
export const OTHER_SECTION = 'Other'

export const CANONICAL_SECTIONS = [
  'Abstract',
  'Introduction',
  'Literature Review',
  'Methods',
  'Results',
  'Discussion',
  'Conclusion',
  'References',
] as const

export type CanonicalSection = (typeof CANONICAL_SECTIONS)[number]
export type ChunkSection = CanonicalSection | typeof UNKNOWN_SECTION | typeof OTHER_SECTION

export type TextChunk = {
  text: string
  chunkIndex: number
  section: ChunkSection
  page: number | null
}

export type SourceLine = {
  text: string
  page: number | null
  isHeading?: boolean
}

export const ingestFileExtension = (fileName: string): string => {
  const parts = fileName.split('.')
  if (parts.length < 2) return ''
  return (parts.pop() ?? '').toLowerCase()
}

export const validateIngestFile = (fileName: string, fileSize: number): string | null => {
  if (fileSize <= 0) {
    return 'File is empty'
  }
  if (fileSize > MAX_INGEST_BYTES) {
    return `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`
  }
  const extension = ingestFileExtension(fileName)
  if (!(INGEST_EXTENSIONS as readonly string[]).includes(extension)) {
    return `Unsupported file type: ${extension || '(none)'}. Allowed: ${INGEST_EXTENSIONS.join(', ')}`
  }
  return null
}

/** Auth and file ids used in Storage object keys (NFR-2). */
export const STORAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const storageObjectKey = (userId: string, fileId: string): string => {
  const user = userId.trim()
  const file = fileId.trim()
  if (!STORAGE_ID_PATTERN.test(user) || !STORAGE_ID_PATTERN.test(file)) {
    throw new Error('Storage path requires user id and file id')
  }
  return `${user}/${file}`
}

export const storageTarget = (
  documentType: IngestDocumentType,
  userId: string,
  fileId: string
): StorageTarget => ({
  bucket: documentType === 'reference' ? 'references' : 'examples',
  key: storageObjectKey(userId, fileId),
})

/** Same rule as storage.objects RLS: first path segment is auth.uid(), then `/`. */
export const userOwnsStorageKey = (userId: string, key: string): boolean => {
  const user = userId.trim()
  const object = key.replace(/^\/+/, '').trim()
  if (!STORAGE_ID_PATTERN.test(user)) return false
  return object.startsWith(`${user}/`) && object.length > user.length + 1
}

export const textFromDocxXml = (xml: string): string =>
  xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const paragraphIsHeading = (xml: string): boolean =>
  /<w:pStyle\b[^>]*w:val="[^"]*Heading/i.test(xml) || /<w:outlineLvl\b/i.test(xml)

export const linesFromDocxXml = (xml: string): SourceLine[] => {
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/gi) ?? []
  const lines: SourceLine[] = []
  for (const paragraph of paragraphs) {
    const text = textFromDocxXml(paragraph).replace(/\n+/g, ' ').trim()
    const isHeading = paragraphIsHeading(paragraph)
    if (!text && !isHeading) continue
    lines.push({ text, page: null, isHeading })
  }
  return lines
}

export const pagesFromExtractText = (text: string | string[] | null | undefined): string[] => {
  if (Array.isArray(text)) return text.map((page) => String(page ?? ''))
  if (typeof text === 'string') return [text]
  return []
}

const HEADING_ALIASES: Array<[RegExp, CanonicalSection]> = [
  [/^abstracts?$/, 'Abstract'],
  [/^intro(duction)?$/, 'Introduction'],
  [/^background$/, 'Introduction'],
  [/^related\s+works?$/, 'Literature Review'],
  [/^literature\s+review$/, 'Literature Review'],
  [/^prior\s+works?$/, 'Literature Review'],
  [/^methods?$/, 'Methods'],
  [/^methodology$/, 'Methods'],
  [/^materials\s+and\s+methods$/, 'Methods'],
  [/^experimental(\s+(setup|procedure|methods?))?$/, 'Methods'],
  [/^results?$/, 'Results'],
  [/^findings$/, 'Results'],
  [/^results?\s+and\s+discussions?$/, 'Results'],
  [/^discussion$/, 'Discussion'],
  [/^conclusions?$/, 'Conclusion'],
  [/^concluding\s+remarks$/, 'Conclusion'],
  [/^references$/, 'References'],
  [/^bibliography$/, 'References'],
  [/^works\s+cited$/, 'References'],
  [/^literature\s+cited$/, 'References'],
]

const OTHER_HEADING_RES = [
  /^appendix(\s+[a-z0-9]+)?$/,
  /^supplementary(\s+materials?)?$/,
  /^acknowledg(e)?ments?$/,
  /^funding$/,
  /^data\s+availability$/,
  /^author\s+contributions?$/,
  /^conflicts?\s+of\s+interest/,
  /^ethics/,
  /^keywords?$/,
]

const headingCandidates = (line: string): string[] => {
  const trimmed = line.trim()
  if (!trimmed) return []
  const stripped = [
    trimmed,
    trimmed.replace(/^#{1,6}\s+/, ''),
    trimmed.replace(/^\d+(\.\d+)*\.?\s+/, ''),
    trimmed.replace(/^[ivxlcdm]{1,6}\.\s+/i, ''),
    trimmed.replace(/^[A-H]\.\s+/, ''),
  ]
  return [...new Set(stripped)]
}

const normalizeHeading = (value: string): string =>
  value.replace(/[:.\s]+$/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const parseHeading = (line: string): ChunkSection | null => {
  const trimmed = line.trim()
  if (trimmed.length < 2 || trimmed.length > 80) return null
  if (trimmed.split(/\s+/).length > 12) return null
  if (/[,;]$/.test(trimmed)) return null

  for (const candidate of headingCandidates(trimmed)) {
    const normalized = normalizeHeading(candidate)
    if (!normalized) continue
    for (const [pattern, section] of HEADING_ALIASES) {
      if (pattern.test(normalized)) return section
    }
    for (const pattern of OTHER_HEADING_RES) {
      if (pattern.test(normalized)) return OTHER_SECTION
    }
  }
  if (/^#{1,6}\s+\S/.test(trimmed)) return OTHER_SECTION
  return null
}

export const linesFromText = (text: string, page: number | null = null): SourceLine[] =>
  text.replace(/\r\n/g, '\n').split('\n').map((line) => ({ text: line, page }))

export const linesFromPages = (pages: string[]): SourceLine[] =>
  pages.flatMap((pageText, index) => linesFromText(pageText, index + 1))

type SectionRun = {
  section: ChunkSection
  page: number | null
  lines: string[]
}

export const splitSectionRuns = (lines: SourceLine[]): SectionRun[] => {
  const runs: SectionRun[] = []
  let current: SectionRun = { section: UNKNOWN_SECTION, page: null, lines: [] }

  const pushCurrent = () => {
    if (current.lines.some((line) => line.trim())) runs.push(current)
  }

  for (const line of lines) {
    const heading = line.isHeading ? parseHeading(line.text) ?? OTHER_SECTION : parseHeading(line.text)
    if (heading) {
      pushCurrent()
      current = {
        section: heading,
        page: line.page,
        lines: line.text.trim() ? [line.text.trim()] : [],
      }
      continue
    }
    if (current.page == null && line.page != null) current.page = line.page
    current.lines.push(line.text)
  }
  pushCurrent()
  return runs
}

const windowChunks = (text: string, chunkSize: number, overlap: number): string[] => {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned) return []
  const out: string[] = []
  let offset = 0
  while (offset < cleaned.length) {
    const end = Math.min(offset + chunkSize, cleaned.length)
    const slice = cleaned.slice(offset, end).trim()
    if (slice.length >= MIN_CHUNK_CHARS) out.push(slice)
    if (end >= cleaned.length) break
    offset += Math.max(chunkSize - overlap, 1)
  }
  return out
}

export const chunkLines = (
  lines: SourceLine[],
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): TextChunk[] => {
  const chunks: TextChunk[] = []
  let chunkIndex = 0
  for (const run of splitSectionRuns(lines)) {
    for (const text of windowChunks(run.lines.join('\n'), chunkSize, overlap)) {
      chunks.push({
        text,
        chunkIndex,
        section: run.section,
        page: run.page,
      })
      chunkIndex += 1
    }
  }
  return chunks
}

export const chunkText = (
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): TextChunk[] => chunkLines(linesFromText(text), chunkSize, overlap)

export const chunkPages = (
  pages: string[],
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): TextChunk[] => chunkLines(linesFromPages(pages), chunkSize, overlap)

export const hashEmbedding = (text: string, dims = EMBEDDING_DIMS): number[] => {
  const vec = new Float64Array(dims)
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  for (const token of tokens) {
    let hash = 2166136261
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const index = Math.abs(hash) % dims
    vec[index] += 1
  }
  let norm = 0
  for (const value of vec) {
    norm += value * value
  }
  norm = Math.sqrt(norm) || 1
  return Array.from(vec, (value) => value / norm)
}
