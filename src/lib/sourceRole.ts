export const SOURCE_ROLES = ['literature', 'primary'] as const

export type SourceRole = (typeof SOURCE_ROLES)[number]

export const DEFAULT_SOURCE_ROLE: SourceRole = 'literature'

export const isSourceRole = (value: unknown): value is SourceRole =>
  value === 'literature' || value === 'primary'

export const parseSourceRole = (value: unknown): SourceRole =>
  value === 'primary' ? 'primary' : DEFAULT_SOURCE_ROLE

export const sourceRoleLabel = (role: SourceRole): string =>
  role === 'primary' ? 'Original research' : 'Literature'
