import { describe, expect, it } from 'vitest'
import {
  INTERROGATION_TURNS_TABLE,
  parseInterrogationRole,
  parseStoredPassages,
} from './interrogationNotes'

describe('interrogation notes (INT-3)', () => {
  it('should parse user and assistant roles only', () => {
    expect(parseInterrogationRole('user')).toBe('user')
    expect(parseInterrogationRole('assistant')).toBe('assistant')
    expect(() => parseInterrogationRole('system')).toThrow(/role/i)
  })

  it('should keep stored passage metadata as notes, not as a retrieve table', () => {
    expect(INTERROGATION_TURNS_TABLE).toBe('interrogation_turns')
    expect(INTERROGATION_TURNS_TABLE).not.toBe('reference_vectors')
    const parsed = parseStoredPassages([
      {
        vector_id: 'vec-1',
        file_id: 'file-1',
        chunk_text: 'methods used nfr7probe',
        source_role: 'primary',
        score: 0.9,
        sid: 'S1',
      },
      { file_id: 'missing-vector' },
      'ignore',
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      vector_id: 'vec-1',
      file_id: 'file-1',
      sid: 'S1',
      source_role: 'primary',
    })
    expect(parseStoredPassages(null)).toEqual([])
  })
})
