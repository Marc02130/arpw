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

describe('storageObjectKey', () => {
  it('should match the upload and delete key shape', () => {
    expect(storageObjectKey('abc-id', 'paper.pdf')).toBe('abc-id_paper.pdf')
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
