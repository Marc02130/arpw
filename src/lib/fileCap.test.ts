import { describe, expect, it } from 'vitest'
import { EXAMPLE_FILE_CAP, REFERENCE_FILE_CAP, remainingSlots, uploadCapError } from './fileCap'

describe('remainingSlots', () => {
  it('should return how many files can still be added', () => {
    expect(remainingSlots(500, 0)).toBe(500)
    expect(remainingSlots(500, 499)).toBe(1)
    expect(remainingSlots(500, 500)).toBe(0)
  })
})

describe('uploadCapError', () => {
  it('should return null when the batch fits', () => {
    expect(uploadCapError(500, 10, 5)).toBeNull()
    expect(uploadCapError(500, 499, 1)).toBeNull()
  })

  it('should refuse when the cap is already full', () => {
    expect(uploadCapError(500, 500, 1)).toBe(
      'File cap reached (500). Delete a file before uploading more.'
    )
  })

  it('should refuse a batch larger than remaining slots', () => {
    expect(uploadCapError(500, 498, 3)).toBe(
      'Too many files. You have 498 of 500 and can add 2 more.'
    )
  })
})

describe('example paper cap (DOCS-2)', () => {
  it('should allow 10 files when none are stored', () => {
    expect(uploadCapError(EXAMPLE_FILE_CAP, 0, 10)).toBeNull()
  })

  it('should refuse an 11th example', () => {
    expect(uploadCapError(EXAMPLE_FILE_CAP, 10, 1)).toBe(
      'File cap reached (10). Delete a file before uploading more.'
    )
  })

  it('should refuse a batch that would pass 10 stored examples', () => {
    expect(uploadCapError(EXAMPLE_FILE_CAP, 9, 2)).toBe(
      'Too many files. You have 9 of 10 and can add 1 more.'
    )
  })

  it('should keep the reference cap at 500', () => {
    expect(REFERENCE_FILE_CAP).toBe(500)
    expect(uploadCapError(REFERENCE_FILE_CAP, 10, 5)).toBeNull()
  })
})
