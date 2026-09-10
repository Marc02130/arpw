const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const firstContentSection = (sections: string[]): string | null => {
  for (const section of sections) {
    if (section !== 'References') return section
  }
  return null
}

/** Pull the `## Section` block. If that heading is missing, return the full outline. */
export const outlineForSection = (outline: string, section: string): string => {
  const text = outline.trim()
  if (!text) return ''
  const heading = new RegExp(`^##\\s+${escapeRegExp(section)}\\s*$`, 'im')
  const match = heading.exec(text)
  if (!match) return text
  const start = match.index + match[0].length
  const rest = text.slice(start)
  const next = rest.search(/^##\s+/m)
  const block = (next === -1 ? rest : rest.slice(0, next)).trim()
  return block ? `## ${section}\n${block}` : `## ${section}`
}

export const buildOutlinePrompt = (
  paperType: string,
  sections: string[],
  researchPrompt: string,
  sourceBlock: string
): string => {
  const headings = sections.filter((section) => section !== 'References')
  const headingList = headings.map((section) => `## ${section}`).join('\n')
  return `Write an outline for a ${paperType} using only the retrieved sources.
Research prompt:
${researchPrompt}

Use exactly these markdown headings, in this order:
${headingList}
Under each heading, write 2–6 short bullets for what that section should cover.
Cite retrieved sources as [S#] where a bullet depends on a source. Do not invent studies, n, or outcomes.
Do not write the full paper. Do not add extra ## headings.

Retrieved sources (cite only these ids, like [S1]):
${sourceBlock}

If you cite a source, use the [S#] id exactly. Do not invent ids.`
}
