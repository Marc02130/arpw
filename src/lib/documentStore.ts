import type { SupabaseClient } from '@supabase/supabase-js'
import { DocumentType } from '../types'
import { storageObjectKey } from '../../supabase/functions/upload_processor/ingest'

export { storageObjectKey }

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

export const deleteOwnedDocument = async (
  client: SupabaseClient,
  userId: string,
  documentType: DocumentType,
  fileId: string
): Promise<void> => {
  const store = documentStore(documentType)
  const { error: vectorError } = await client.from(store.vectorTable).delete().eq('file_id', fileId)
  if (vectorError) throw new Error(vectorError.message)

  const { data, error: rowError } = await client
    .from(store.table)
    .delete()
    .eq('file_id', fileId)
    .eq('user_id', userId)
    .select('file_id')
  if (rowError) throw new Error(rowError.message)
  if (!data || data.length === 0) throw new Error('File not found')

  const { error: storageError } = await client.storage
    .from(store.bucket)
    .remove([storageObjectKey(userId, fileId)])
  if (storageError) {
    console.warn('Storage deletion error:', storageError)
  }
}
