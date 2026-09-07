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
import { formatStyleForPrompt, type RetrievedPassage } from './retrievePassages.ts'
import { attributeSentences, type SentenceAttribution } from './attribution.ts'
import { parsePaperId } from './saveGeneratedDraft.ts'

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
  attribution: SentenceAttribution[]
}

export const buildSectionPrompt = (
  paperType: string,
  section: string,
  researchPrompt: string,
  sourceBlock: string,
  styleBlock = ''
): string => {
  const style = styleBlock.trim()
    ? `

${styleBlock.trim()}
`
    : ''
  return `${buildGenerationPrompt(paperType, section, researchPrompt)}
${style}
Retrieved sources (cite only these ids, like [S1]):
${sourceBlock}

If you cite a source, use the [S#] id exactly. Do not invent ids. Do not cite style examples.`
}

const CITATION_STYLES = new Set(['APA', 'MLA', 'Chicago'])
const OUTPUT_FORMATS = new Set(['word', 'markdown'])

export type GenerateRequest = {
  paperId: string
  paperType: string
  sections: string[]
  researchPrompt: string
  citationStyle?: string
  outputFormat?: string
}

export const parseGenerateRequest = (body: unknown): GenerateRequest => {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid generate request')
  }
  const rec = body as Record<string, unknown>
  const paperId = parsePaperId(rec.paperId)
  if (!paperId) {
    throw new Error('Start or continue a paper from the Dashboard first')
  }
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
  let citationStyle: string | undefined
  if (rec.citationStyle !== undefined) {
    if (typeof rec.citationStyle !== 'string' || !CITATION_STYLES.has(rec.citationStyle)) {
      throw new Error('Unknown citation style')
    }
    citationStyle = rec.citationStyle
  }
  let outputFormat: string | undefined
  if (rec.outputFormat !== undefined) {
    if (typeof rec.outputFormat !== 'string' || !OUTPUT_FORMATS.has(rec.outputFormat)) {
      throw new Error('Unknown output format')
    }
    outputFormat = rec.outputFormat
  }
  return { paperId, paperType: rec.paperType, sections, researchPrompt, citationStyle, outputFormat }
}

export const generatePaperDraft = async (opts: {
  paperType: string
  sections: string[]
  researchPrompt: string
  retrieve: GenerateRetrieve
  complete: GenerateComplete
  retrieveExamples?: GenerateRetrieve
}): Promise<{
  sections: GeneratedSection[]
  content: string
  citedFileIds: string[]
  attribution: SentenceAttribution[]
}> => {
  const topic = opts.researchPrompt.trim()
  if (!topic) {
    throw new Error('Enter a research prompt')
  }

  const generated: GeneratedSection[] = []
  const allFileIds = new Set<string>()
  const attribution: SentenceAttribution[] = []

  for (const section of opts.sections) {
    const template = getSectionTemplate(opts.paperType, section)
    const passages =
      template.preferredSourceRole === 'none' ? [] : await opts.retrieve(opts.paperType, section, topic)
    const sources = numberSources(passages)
    const allowed = new Set(sources.map((source) => source.sid))
    const examplePassages =
      template.preferredSourceRole === 'none' || !opts.retrieveExamples
        ? []
        : await opts.retrieveExamples(opts.paperType, section, topic)
    const styleBlock = formatStyleForPrompt(examplePassages)
    const prompt = buildSectionPrompt(
      opts.paperType,
      section,
      topic,
      formatSourcesForPrompt(sources),
      styleBlock
    )
    const raw = await opts.complete(prompt)
    const text = stripUnknownCitations(raw, allowed)
    const sids = citedSids(text, allowed)
    const fileIds = fileIdsForSids(sids, sources)
    fileIds.forEach((id) => allFileIds.add(id))
    const sectionAttribution =
      template.preferredSourceRole === 'none' ? [] : attributeSentences(text, section, sources)
    attribution.push(...sectionAttribution)
    generated.push({
      name: section,
      text,
      citedSids: sids,
      citedFileIds: fileIds,
      attribution: sectionAttribution,
    })
  }

  const content = generated.map((section) => `## ${section.name}\n\n${section.text}`).join('\n\n')
  return { sections: generated, content, citedFileIds: [...allFileIds], attribution }
}
