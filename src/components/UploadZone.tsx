import React, { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { UploadProgress, DocumentType, type SourceRole } from '../types'
import { ACCEPTED_UPLOAD_EXTENSIONS, validateUploadFile } from '../lib/validateFile'
import { uploadCapError } from '../lib/fileCap'
import { documentStore, storageObjectKey } from '../lib/documentStore'
import {
  patchFileProgress,
  startUploadProgress,
  uploadStatusText,
} from '../lib/uploadProgress'

interface UploadZoneProps {
  documentType: DocumentType
  maxFiles: number
  onUploadComplete: () => void
  onUploadError: (error: string) => void
  sourceRole?: SourceRole
}

const UploadZone: React.FC<UploadZoneProps> = ({
  documentType,
  maxFiles,
  onUploadComplete,
  onUploadError,
  sourceRole,
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [existingCount, setExistingCount] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)


  const store = documentStore(documentType)
  const tableName = store.table
  const bucketName = store.bucket

  const countExisting = async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Could not count existing files: ${error.message}`)
    }
    const total = count ?? 0
    setExistingCount(total)
    return total
  }

  const uploadFile = async (file: File): Promise<void> => {
    const fileId = crypto.randomUUID()
    setUploadProgress((prev) => [...prev, startUploadProgress(fileId, file.name)])

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const objectKey = storageObjectKey(user.id, fileId)

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(objectKey, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      const { error: insertError } = await supabase.from(tableName).insert({
        file_id: fileId,
        user_id: user.id,
        document_type: documentType,
        file_name: file.name,
        file_size: file.size,
        ...(documentType === DocumentType.REFERENCE
          ? { source_role: sourceRole ?? 'literature' }
          : {}),
      })

      if (insertError) {
        await supabase.storage.from(bucketName).remove([objectKey])
        throw new Error(`Upload failed: ${insertError.message}`)
      }

      setUploadProgress((prev) =>
        patchFileProgress(prev, fileId, { progress: 80, status: 'processing' })
      )

      try {
        await supabase.functions.invoke('upload_processor', {
          body: {
            fileId,
            fileName: file.name,
            fileSize: file.size,
            documentType,
          },
        })
      } catch (processError) {
        console.warn('Indexing skipped or failed:', processError)
      }

      setUploadProgress((prev) =>
        patchFileProgress(prev, fileId, { progress: 100, status: 'completed' })
      )

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      // Update progress to error
      setUploadProgress((prev) =>
        patchFileProgress(prev, fileId, { progress: 0, status: 'error', error: errorMessage })
      )
      
      onUploadError(errorMessage)
    }
  }

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      const validationError = validateUploadFile(file)
      if (validationError) {
        onUploadError(validationError)
        return
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      onUploadError('User not authenticated')
      return
    }

    let existing: number
    try {
      existing = await countExisting(user.id)
    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Could not count existing files')
      return
    }

    const capError = uploadCapError(maxFiles, existing, fileArray.length)
    if (capError) {
      onUploadError(capError)
      return
    }

    setIsUploading(true)
    setUploadProgress([])

    try {
      const batchSize = 10
      for (let i = 0; i < fileArray.length; i += batchSize) {
        const batch = fileArray.slice(i, i + batchSize)
        await Promise.all(batch.map((file) => uploadFile(file)))
      }

      onUploadComplete()
    } catch (error) {
      console.error('Batch upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }, [maxFiles, onUploadComplete, onUploadError, documentType])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFiles])

  const handleClick = useCallback(() => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click()
    }
  }, [isUploading])

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        await countExisting(user.id)
      } catch {
        setExistingCount(null)
      }
    })()
  }, [documentType])

  const clearProgress = useCallback(() => {
    setUploadProgress([])
  }, [])

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'processing':
        return (
          <svg className="animate-spin h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'completed':
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      default:
        return null
    }
  }

  const getStatusText = uploadStatusText

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${
          isDragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Upload ${documentType} files`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_EXTENSIONS.join(',')}
          onChange={handleFileInput}
          className="hidden"
          aria-hidden="true"
        />
        
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <div className="text-sm text-gray-600">
            <span className="font-medium text-primary-600 hover:text-primary-500">
              Click to upload
            </span>{' '}
            or drag and drop
          </div>
          
          <p className="text-xs text-gray-500">
            {documentType === DocumentType.REFERENCE
              ? `Up to ${maxFiles} reference documents`
              : `Up to ${maxFiles} example papers`}{' '}
            (PDF, DOCX, TXT)
            {existingCount !== null ? ` · ${existingCount} stored` : ''}
          </p>
          
          <p className="text-xs text-gray-400">
            Maximum file size: 10MB
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Upload Progress ({uploadProgress.length} files)
            </h3>
            <button
              onClick={clearProgress}
              className="text-xs text-gray-500 hover:text-gray-700"
              disabled={isUploading}
            >
              Clear
            </button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploadProgress.map((progress) => (
              <div
                key={progress.fileId}
                className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg"
              >
                {getStatusIcon(progress.status)}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {progress.fileName}
                  </p>
                  
                  {progress.status === 'error' && progress.error && (
                    <p className="text-xs text-red-600 truncate">
                      {progress.error}
                    </p>
                  )}
                  
                  {progress.status !== 'error' && (
                    <p className="text-xs text-gray-500">
                      {getStatusText(progress.status)}
                    </p>
                  )}
                </div>
                
                {progress.status !== 'error' && (
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8">
                      {progress.progress}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadZone
