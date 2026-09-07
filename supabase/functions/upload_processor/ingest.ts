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

export type TextChunk = {
  text: string
  chunkIndex: number
  section: string
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

export const storageTarget = (
  documentType: IngestDocumentType,
  storagePath: string
): StorageTarget => {
  const bucket = documentType === 'reference' ? 'references' : 'examples'
  const trimmed = storagePath.replace(/^\/+/, '').trim()
  const key = trimmed.includes('/') ? trimmed.slice(trimmed.lastIndexOf('/') + 1) : trimmed
  if (!key) {
    throw new Error('Missing storage key')
  }
  return { bucket, key }
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

export const chunkText = (
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): TextChunk[] => {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  const chunks: TextChunk[] = []
  let offset = 0
  let chunkIndex = 0

  while (offset < cleaned.length) {
    const end = Math.min(offset + chunkSize, cleaned.length)
    const slice = cleaned.slice(offset, end).trim()
    if (slice.length >= MIN_CHUNK_CHARS) {
      const firstLine = slice.split('\n').find((line) => line.trim()) ?? slice
      chunks.push({
        text: slice,
        chunkIndex,
        section: firstLine.slice(0, 80),
      })
      chunkIndex += 1
    }
    if (end >= cleaned.length) break
    offset += Math.max(chunkSize - overlap, 1)
  }

  return chunks
}

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
