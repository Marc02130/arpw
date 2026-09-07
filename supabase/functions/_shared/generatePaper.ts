import {
  citedSids,
  fileIdsForSids,
  formatSourcesForPrompt,
  numberSources,
  stripUnknownCitations,
} from './citations.ts'
import {
  PAPER_SECTIONS,
  buildGenerationPrompt,
  getSectionTemplate,
  isKnownPaperType,
} from './generationTemplates.ts'
import type { RetrievedPassage } from './retrievePassages.ts'

export type GenerateComplete = (prompt: string) => Promise<string>

export type GenerateRetrieve = (
  paperType: string,
  section: string,
  researchPrompt: string
) => Promise<RetrievedPassage[]>

export type GeneratedSection = {
  name: string
  text: string
  citedSids: string[]
  citedFileIds: string[]
}

export const buildSectionPrompt = (
  paperType: string,
  section: string,
  researchPrompt: string,
  sourceBlock: string
): string =>
  `${buildGenerationPrompt(paperType, section, researchPrompt)}

Retrieved sources (cite only these ids, like [S1]):
${sourceBlock}

If you cite a source, use the [S#] id exactly. Do not invent ids.`

export const parseGenerateRequest = (
  body: unknown
): { paperType: string; sections: string[]; researchPrompt: string } => {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid generate request')
  }
  const rec = body as Record<string, unknown>
  if (typeof rec.paperType !== 'string' || !isKnownPaperType(rec.paperType)) {
    throw new Error('Unknown paper type')
  }
  if (!Array.isArray(rec.sections) || rec.sections.length === 0) {
    throw new Error('Select at least one section')
  }
  const allowed = new Set<string>(PAPER_SECTIONS)
  const sections: string[] = []
  for (const section of rec.sections) {
    if (typeof section !== 'string' || !allowed.has(section)) {
      throw new Error(`Unknown paper section: ${String(section)}`)
    }
    if (!sections.includes(section)) sections.push(section)
  }
  const researchPrompt = typeof rec.researchPrompt === 'string' ? rec.researchPrompt.trim() : ''
  if (!researchPrompt) {
    throw new Error('Enter a research prompt')
  }
  return { paperType: rec.paperType, sections, researchPrompt }
}

export const generatePaperDraft = async (opts: {
  paperType: string
  sections: string[]
  researchPrompt: string
  retrieve: GenerateRetrieve
  complete: GenerateComplete
}): Promise<{ sections: GeneratedSection[]; content: string; citedFileIds: string[] }> => {
  const topic = opts.researchPrompt.trim()
  if (!topic) {
    throw new Error('Enter a research prompt')
  }

  const generated: GeneratedSection[] = []
  const allFileIds = new Set<string>()

  for (const section of opts.sections) {
    const template = getSectionTemplate(opts.paperType, section)
    const passages =
      template.preferredSourceRole === 'none' ? [] : await opts.retrieve(opts.paperType, section, topic)
    const sources = numberSources(passages)
    const allowed = new Set(sources.map((source) => source.sid))
    const prompt = buildSectionPrompt(opts.paperType, section, topic, formatSourcesForPrompt(sources))
    const raw = await opts.complete(prompt)
    const text = stripUnknownCitations(raw, allowed)
    const sids = citedSids(text, allowed)
    const fileIds = fileIdsForSids(sids, sources)
    fileIds.forEach((id) => allFileIds.add(id))
    generated.push({ name: section, text, citedSids: sids, citedFileIds: fileIds })
  }

  const content = generated.map((section) => `## ${section.name}\n\n${section.text}`).join('\n\n')
  return { sections: generated, content, citedFileIds: [...allFileIds] }
}
