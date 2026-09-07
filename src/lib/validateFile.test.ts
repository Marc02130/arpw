import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, validateUploadFile } from './validateFile'

describe('validateUploadFile', () => {
  it('should accept a pdf under 10MB', () => {
    expect(validateUploadFile({ name: 'paper.pdf', size: 1024 })).toBeNull()
  })

  it('should accept docx and txt', () => {
    expect(validateUploadFile({ name: 'notes.DOCX', size: 1 })).toBeNull()
    expect(validateUploadFile({ name: 'plain.txt', size: 10 })).toBeNull()
  })

  it('should reject an empty file', () => {
    expect(validateUploadFile({ name: 'empty.pdf', size: 0 })).toBe(
      'File "empty.pdf" is empty.'
    )
  })

  it('should reject a file over 10MB', () => {
    expect(validateUploadFile({ name: 'big.pdf', size: MAX_UPLOAD_BYTES + 1 })).toBe(
      'File "big.pdf" is too large. Maximum size is 10MB.'
    )
  })

  it('should reject .doc', () => {
    expect(validateUploadFile({ name: 'legacy.doc', size: 100 })).toBe(
      'File "legacy.doc" has an unsupported format. Supported formats: PDF, DOCX, TXT.'
    )
  })

  it('should reject a name with no extension', () => {
    expect(validateUploadFile({ name: 'readme', size: 10 })).toContain('unsupported format')
  })
})
