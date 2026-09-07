import { describe, expect, it } from 'vitest'
import {
  patchFileProgress,
  startUploadProgress,
  uploadStatusText,
} from './uploadProgress'

describe('per-file upload progress (DOCS-3)', () => {
  it('should start each file at uploading 0%', () => {
    const row = startUploadProgress('id-1', 'paper.pdf')
    expect(row).toEqual({
      fileId: 'id-1',
      fileName: 'paper.pdf',
      progress: 0,
      status: 'uploading',
    })
  })

  it('should update one file without changing another', () => {
    const list = [
      startUploadProgress('a', 'one.pdf'),
      startUploadProgress('b', 'two.txt'),
    ]
    const next = patchFileProgress(list, 'a', { progress: 80, status: 'processing' })
    expect(next.find((row) => row.fileId === 'a')).toMatchObject({
      progress: 80,
      status: 'processing',
    })
    expect(next.find((row) => row.fileId === 'b')).toMatchObject({
      progress: 0,
      status: 'uploading',
      fileName: 'two.txt',
    })
  })

  it('should label each progress status', () => {
    expect(uploadStatusText('uploading')).toBe('Uploading...')
    expect(uploadStatusText('processing')).toBe('Processing...')
    expect(uploadStatusText('completed')).toBe('Completed')
    expect(uploadStatusText('error')).toBe('Error')
  })
})
