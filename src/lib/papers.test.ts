import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAPER_SECTIONS,
  draftTitle,
  generatedDraftUpdateFields,
  nextVersionForTitle,
  paperConfigIsHydrated,
  paperSectionsOrDefault,
  parsePaperId,
  referenceCountFromEmbed,
  uniqueFileIds,
} from './papers'

describe('papers helpers', () => {
  it('should title a new draft', () => {
    expect(draftTitle('  Climate and citations  ')).toBe('Climate and citations')
    expect(draftTitle('   ')).toBe('Untitled paper')
  })

  it('should keep default IMRaD sections when none are stored', () => {
    expect(paperSectionsOrDefault(null)).toEqual(DEFAULT_PAPER_SECTIONS)
    expect(paperSectionsOrDefault(['Abstract', 'Methods'])).toEqual(['Abstract', 'Methods'])
  })

  it('should parse paper ids and unique cited file ids (slice 5)', () => {
    expect(parsePaperId('11111111-1111-4111-8111-111111111111')).toBe(
      '11111111-1111-4111-8111-111111111111'
    )
    expect(parsePaperId('not-a-uuid')).toBeNull()
    expect(uniqueFileIds(['a', 'a', '', 'b'])).toEqual(['a', 'b'])
    expect(referenceCountFromEmbed([{ count: 3 }])).toBe(3)
    expect(referenceCountFromEmbed([])).toBe(0)
  })

  it('should not persist generate config until the paper row is loaded', () => {
    expect(paperConfigIsHydrated(null, '11111111-1111-4111-8111-111111111111')).toBe(false)
    expect(paperConfigIsHydrated({ paper_id: '11111111-1111-4111-8111-111111111111' }, null)).toBe(
      false
    )
    expect(
      paperConfigIsHydrated(
        { paper_id: '11111111-1111-4111-8111-111111111111' },
        '22222222-2222-4222-8222-222222222222'
      )
    ).toBe(false)
    expect(
      paperConfigIsHydrated(
        { paper_id: '11111111-1111-4111-8111-111111111111' },
        '11111111-1111-4111-8111-111111111111'
      )
    ).toBe(true)
  })

  it('should not let generate overwrite the stored paper type', () => {
    const patch = generatedDraftUpdateFields({
      paperId: '11111111-1111-4111-8111-111111111111',
      content: '## Abstract\n\nDraft [S1].',
      sections: ['Abstract'],
      paperType: 'Empirical Study',
      citationStyle: 'APA',
      outputFormat: 'markdown',
      citedFileIds: [],
    })
    expect(patch).toMatchObject({
      content: '## Abstract\n\nDraft [S1].',
      sections: ['Abstract'],
      status: 'completed',
      citation_style: 'APA',
      output_format: 'markdown',
    })
    expect(patch).not.toHaveProperty('paper_type')
  })

  it('should increment regenerate version from existing titles (LIB-2)', () => {
    expect(nextVersionForTitle([])).toBe(1)
    expect(nextVersionForTitle([1])).toBe(2)
    expect(nextVersionForTitle([1, 3, 2])).toBe(4)
  })
})
