import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCE_ROLE,
  isSourceRole,
  parseSourceRole,
  sourceRoleLabel,
} from './sourceRole'

describe('sourceRole (DOCS-8)', () => {
  it('should default unknown values to literature', () => {
    expect(parseSourceRole(undefined)).toBe(DEFAULT_SOURCE_ROLE)
    expect(parseSourceRole('literature')).toBe('literature')
    expect(parseSourceRole('primary')).toBe('primary')
    expect(parseSourceRole('example')).toBe('literature')
    expect(isSourceRole('primary')).toBe(true)
    expect(isSourceRole('evidence')).toBe(false)
  })

  it('should label primary as original research', () => {
    expect(sourceRoleLabel('literature')).toBe('Literature')
    expect(sourceRoleLabel('primary')).toBe('Original research')
  })
})
