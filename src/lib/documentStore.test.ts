import { describe, expect, it } from 'vitest'
import { DocumentType } from '../types'
import {
  documentStore,
  indexStatusLabel,
  storageObjectKey,
  vectorCountFromEmbed,
} from './documentStore'

describe('documentStore', () => {
  it('should map references to table, bucket, and vector table', () => {
    expect(documentStore(DocumentType.REFERENCE)).toEqual({
      table: 'references',
      bucket: 'references',
      vectorTable: 'reference_vectors',
    })
  })

  it('should map examples the same way', () => {
    expect(documentStore(DocumentType.EXAMPLE)).toEqual({
      table: 'examples',
      bucket: 'examples',
      vectorTable: 'example_vectors',
    })
  })
})

describe('storageObjectKey (NFR-2)', () => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const fileId = '22222222-2222-4222-8222-222222222222'

  it('should be {user_id}/{file_id} with no original filename', () => {
    expect(storageObjectKey(userId, fileId)).toBe(`${userId}/${fileId}`)
    expect(storageObjectKey(userId, fileId)).not.toContain('paper.pdf')
  })

  it('should reject non-uuid ids so a client cannot pass a path', () => {
    expect(() => storageObjectKey('../etc', fileId)).toThrow('Storage path requires user id and file id')
    expect(() => storageObjectKey(userId, 'paper.pdf')).toThrow('Storage path requires user id and file id')
    expect(() => storageObjectKey(userId, `${fileId}/extra`)).toThrow(
      'Storage path requires user id and file id'
    )
    expect(() => storageObjectKey('', fileId)).toThrow('Storage path requires user id and file id')
  })
})

describe('vectorCountFromEmbed', () => {
  it('should read supabase count embeds', () => {
    expect(vectorCountFromEmbed([{ count: 4 }])).toBe(4)
    expect(vectorCountFromEmbed([])).toBe(0)
    expect(vectorCountFromEmbed(null)).toBe(0)
  })
})

describe('indexStatusLabel', () => {
  it('should distinguish stored vs indexed', () => {
    expect(indexStatusLabel(0)).toBe('Stored (not indexed)')
    expect(indexStatusLabel(3)).toBe('Indexed (3 chunks)')
  })
})
