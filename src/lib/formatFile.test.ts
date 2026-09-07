import { describe, expect, it } from 'vitest'
import { fileTypeIcon, formatFileSize, formatUploadedAt } from './formatFile'

describe('formatFileSize', () => {
  it('should format bytes, KB, and MB', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
    expect(formatFileSize(30)).toBe('30 Bytes')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1048576)).toBe('1 MB')
  })
})

describe('formatUploadedAt', () => {
  it('should format a valid ISO timestamp in en-US', () => {
    const text = formatUploadedAt('2026-09-06T22:02:00.000Z', 'en-US')
    expect(text).toContain('2026')
    expect(text).toContain('Sep')
  })

  it('should return the input when the date is invalid', () => {
    expect(formatUploadedAt('not-a-date')).toBe('not-a-date')
  })
})

describe('fileTypeIcon', () => {
  it('should pick an icon from the extension', () => {
    expect(fileTypeIcon('a.pdf')).toBe('📄')
    expect(fileTypeIcon('a.docx')).toBe('📝')
    expect(fileTypeIcon('a.txt')).toBe('📃')
    expect(fileTypeIcon('a.bin')).toBe('📁')
  })
})
