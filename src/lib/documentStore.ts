import { DocumentType } from '../types'

export { storageObjectKey } from '../../supabase/functions/upload_processor/ingest'

export type DocumentStore = {
  table: 'references' | 'examples'
  bucket: 'references' | 'examples'
  vectorTable: 'reference_vectors' | 'example_vectors'
}

export const documentStore = (documentType: DocumentType): DocumentStore =>
  documentType === DocumentType.REFERENCE
    ? { table: 'references', bucket: 'references', vectorTable: 'reference_vectors' }
    : { table: 'examples', bucket: 'examples', vectorTable: 'example_vectors' }

export const vectorCountFromEmbed = (value: unknown): number => {
  if (!Array.isArray(value) || value.length === 0) return 0
  const first = value[0] as { count?: unknown }
  return typeof first?.count === 'number' ? first.count : 0
}

export const indexStatusLabel = (chunkCount: number): string =>
  chunkCount > 0 ? `Indexed (${chunkCount} chunks)` : 'Stored (not indexed)'
