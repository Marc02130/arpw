import { describe, expect, it } from 'vitest'
import { remainingSlots, uploadCapError } from './fileCap'

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
