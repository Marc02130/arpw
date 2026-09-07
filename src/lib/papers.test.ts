import { describe, expect, it } from 'vitest'
import { DEFAULT_PAPER_SECTIONS, draftTitle, paperSectionsOrDefault } from './papers'

describe('papers helpers', () => {
  it('should title a new draft', () => {
    expect(draftTitle('  Climate and citations  ')).toBe('Climate and citations')
    expect(draftTitle('   ')).toBe('Untitled paper')
  })

  it('should keep default IMRaD sections when none are stored', () => {
    expect(paperSectionsOrDefault(null)).toEqual(DEFAULT_PAPER_SECTIONS)
    expect(paperSectionsOrDefault(['Abstract', 'Methods'])).toEqual(['Abstract', 'Methods'])
  })
})
