export type FormatCheckResult = {
  ok: boolean
  required: string[]
  present: string[]
  missing: string[]
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const markdownSectionHeadings = (content: string): string[] => {
  const found = content.match(/^#{2,3}\s+.+$/gm) ?? []
  const names = found.map((line) => line.replace(/^#{2,3}\s+/, '').trim()).filter(Boolean)
  return [...new Set(names)]
}

export const sectionHeadingPresent = (content: string, section: string): boolean => {
  const name = section.trim()
  if (!name) return false
  const re = new RegExp(`^#{2,3}\\s+${escapeRegExp(name)}\\s*$`, 'm')
  return re.test(content)
}

export const runFormatCheck = (input: {
  content: string
  requiredSections: Iterable<string>
}): FormatCheckResult => {
  const required = [...new Set([...input.requiredSections].map((name) => name.trim()).filter(Boolean))]
  const present = required.filter((section) => sectionHeadingPresent(input.content, section))
  const missing = required.filter((section) => !present.includes(section))
  return { ok: missing.length === 0, required, present, missing }
}

export const formatCheckLabel = (result: FormatCheckResult): string => {
  if (result.required.length === 0) {
    return 'Format check passed (no required sections).'
  }
  if (result.ok) {
    return `Format check passed (${result.present.length} required section${result.present.length === 1 ? '' : 's'} present).`
  }
  return `Format check failed: missing ${result.missing.join(', ')}.`
}
