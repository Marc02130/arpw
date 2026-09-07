import { describe, expect, it } from 'vitest'
import {
  attachPinDetails,
  isPinTargetSection,
  isVectorPinned,
  parsePinTargetSection,
  pinForVector,
} from './pins'

const pin = {
  pin_id: 'p1',
  paper_id: 'paper-1',
  file_id: 'file-1',
  vector_id: 'vec-1',
  target_section: 'Methods' as string | null,
  created_at: '2026-09-07T00:00:00Z',
}

describe('pins helpers (PIN-1)', () => {
  it('should accept paper sections or null as the pin target', () => {
    expect(parsePinTargetSection(null)).toBeNull()
    expect(parsePinTargetSection('')).toBeNull()
    expect(parsePinTargetSection('Methods')).toBe('Methods')
    expect(parsePinTargetSection('Literature Review')).toBe('Literature Review')
    expect(isPinTargetSection('Results')).toBe(true)
    expect(isPinTargetSection('Appendix')).toBe(false)
    expect(() => parsePinTargetSection('Appendix')).toThrow('Invalid pin target section')
    expect(() => parsePinTargetSection('Interrogate')).toThrow('Invalid pin target section')
    expect(() => parsePinTargetSection(12)).toThrow('Invalid pin target section')
  })

  it('should attach file name and chunk text to pin rows', () => {
    const attached = attachPinDetails(
      [pin, { ...pin, pin_id: 'p2', file_id: 'missing', vector_id: 'missing' }],
      [{ file_id: 'file-1', file_name: 'methods.txt', source_role: 'primary' }],
      [{ vector_id: 'vec-1', chunk_text: 'We measured overlap.' }]
    )
    expect(attached[0]).toMatchObject({
      pin_id: 'p1',
      file_name: 'methods.txt',
      source_role: 'primary',
      chunk_text: 'We measured overlap.',
    })
    expect(attached[1]).toMatchObject({
      file_name: 'Unknown file',
      source_role: 'literature',
      chunk_text: '',
    })
  })

  it('should find a pin by vector id', () => {
    expect(isVectorPinned([pin], 'vec-1')).toBe(true)
    expect(isVectorPinned([pin], 'vec-2')).toBe(false)
    expect(pinForVector([pin], 'vec-1')?.pin_id).toBe('p1')
    expect(pinForVector([pin], 'vec-2')).toBeUndefined()
  })
})
