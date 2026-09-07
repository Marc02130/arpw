import { UploadProgress } from '../types'

export const startUploadProgress = (fileId: string, fileName: string): UploadProgress => ({
  fileId,
  fileName,
  progress: 0,
  status: 'uploading',
})

export const patchFileProgress = (
  list: UploadProgress[],
  fileId: string,
  patch: Partial<UploadProgress>
): UploadProgress[] => list.map((row) => (row.fileId === fileId ? { ...row, ...patch } : row))

export const uploadStatusText = (status: UploadProgress['status']): string => {
  switch (status) {
    case 'uploading':
      return 'Uploading...'
    case 'processing':
      return 'Processing...'
    case 'completed':
      return 'Completed'
    case 'error':
      return 'Error'
    default:
      return ''
  }
}
