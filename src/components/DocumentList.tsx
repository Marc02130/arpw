import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { DocumentType } from '../types'
import {
  documentStore,
  indexStatusLabel,
  storageObjectKey,
  vectorCountFromEmbed,
} from '../lib/documentStore'
import { fileTypeIcon, formatFileSize, formatUploadedAt } from '../lib/formatFile'
import {
  type SourceRole,
  isSourceRole,
  parseSourceRole,
  sourceRoleLabel,
} from '../lib/sourceRole'

type ListedDocument = {
  file_id: string
  user_id: string
  document_type: string
  file_name: string
  file_size: number
  uploaded_at: string
  chunkCount: number
  source_role: SourceRole
}

interface DocumentListProps {
  documentType: DocumentType
  onDocumentDeleted: () => void
  onRoleChanged?: () => void
  sourceRole?: SourceRole
  refreshKey?: number
  heading?: string
}

const DocumentList: React.FC<DocumentListProps> = ({
  documentType,
  onDocumentDeleted,
  onRoleChanged,
  sourceRole,
  refreshKey = 0,
  heading,
}) => {
  const [documents, setDocuments] = useState<ListedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [savingRoleIds, setSavingRoleIds] = useState<Set<string>>(new Set())
  const showRole = documentType === DocumentType.REFERENCE

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      const store = documentStore(documentType)

      let query = supabase
        .from(store.table)
        .select(`*, ${store.vectorTable}(count)`)
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
      if (documentType === DocumentType.REFERENCE && sourceRole) {
        query = query.eq('source_role', sourceRole)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      const rows = (data ?? []).map((row: Record<string, unknown>) => {
        const chunkCount = vectorCountFromEmbed(row[store.vectorTable])
        return {
          file_id: String(row.file_id),
          user_id: String(row.user_id),
          document_type: String(row.document_type),
          file_name: String(row.file_name),
          file_size: Number(row.file_size),
          uploaded_at: String(row.uploaded_at),
          chunkCount,
          source_role: parseSourceRole(row.source_role),
        }
      })
      setDocuments(rows)
    } catch (error) {
      console.error('Error fetching documents:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [documentType, sourceRole, refreshKey])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleRoleChange = async (fileId: string, next: string) => {
    if (!showRole || !isSourceRole(next)) return

    setSavingRoleIds((prev) => new Set(prev).add(fileId))
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error: updateError } = await supabase
        .from('references')
        .update({ source_role: next })
        .eq('file_id', fileId)
        .eq('user_id', user.id)
      if (updateError) throw new Error(updateError.message)

      setDocuments((prev) =>
        prev
          .map((doc) => (doc.file_id === fileId ? { ...doc, source_role: next } : doc))
          .filter((doc) => !sourceRole || doc.source_role === sourceRole)
      )
      onRoleChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSavingRoleIds((prev) => {
        const nextIds = new Set(prev)
        nextIds.delete(fileId)
        return nextIds
      })
    }
  }

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingIds(prev => new Set(prev).add(fileId))
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const store = documentStore(documentType)

      const { error: vectorError } = await supabase
        .from(store.vectorTable)
        .delete()
        .eq('file_id', fileId)
      if (vectorError) {
        console.warn('Vector deletion error:', vectorError)
      }

      const { error: dbError } = await supabase
        .from(store.table)
        .delete()
        .eq('file_id', fileId)
        .eq('user_id', user.id)

      if (dbError) {
        throw new Error(dbError.message)
      }

      const { error: storageError } = await supabase.storage
        .from(store.bucket)
        .remove([storageObjectKey(user.id, fileId)])
      if (storageError) {
        console.warn('Storage deletion error:', storageError)
      }

      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.file_id !== fileId))
      onDocumentDeleted()

    } catch (error) {
      console.error('Error deleting document:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete document')
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={fetchDocuments}
              className="mt-1 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-4xl mb-2">
          {documentType === DocumentType.REFERENCE ? '📚' : '📖'}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          {heading
            ? `No ${heading.toLowerCase()} yet`
            : `No ${documentType}s uploaded yet`}
        </h3>
        <p className="text-gray-500">
          {sourceRole === 'primary'
            ? 'Upload your own research on this paper’s topic.'
            : sourceRole === 'literature'
              ? 'Upload published papers you will cite.'
              : `Upload your first ${documentType} to get started.`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {heading ??
            (documentType === DocumentType.REFERENCE ? 'Reference Documents' : 'Example Papers')}{' '}
          ({documents.length})
        </h3>
        <button
          onClick={fetchDocuments}
          className="text-sm text-primary-600 hover:text-primary-500"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {/* Documents Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Index
                </th>
                {showRole && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.file_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg mr-3" role="img" aria-label="File type">
                        {fileTypeIcon(doc.file_name)}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {doc.file_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {doc.document_type}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatFileSize(doc.file_size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatUploadedAt(doc.uploaded_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {indexStatusLabel(doc.chunkCount)}
                  </td>
                  {showRole && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <select
                        value={doc.source_role}
                        onChange={(event) => void handleRoleChange(doc.file_id, event.target.value)}
                        disabled={savingRoleIds.has(doc.file_id)}
                        className="rounded border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                        aria-label={`Role for ${doc.file_name}`}
                      >
                        <option value="literature">{sourceRoleLabel('literature')}</option>
                        <option value="primary">{sourceRoleLabel('primary')}</option>
                      </select>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDelete(doc.file_id, doc.file_name)}
                      disabled={deletingIds.has(doc.file_id)}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Delete ${doc.file_name}`}
                    >
                      {deletingIds.has(doc.file_id) ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deleting...
                        </span>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500">
        Total size: {formatFileSize(documents.reduce((sum, doc) => sum + doc.file_size, 0))}
      </div>
    </div>
  )
}

export default DocumentList
