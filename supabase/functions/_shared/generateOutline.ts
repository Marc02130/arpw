import {
  formatSourcesForPrompt,
  numberSources,
  stripUnknownCitations,
} from './citations.ts'
import { isKnownPaperType, PAPER_SECTIONS } from './generationTemplates.ts'
import { parsePaperId } from './saveGeneratedDraft.ts'
import { buildOutlinePrompt, firstContentSection } from './outline.ts'
import type { RetrievedPassage } from './retrievePassages.ts'

export type OutlineComplete = (prompt: string) => Promise<string>
export type OutlineRetrieve = (
  paperType: string,
  section: string,
  researchPrompt: string
) => Promise<RetrievedPassage[]>

export type OutlineRequest = {
  paperId: string
  paperType: string
  sections: string[]
  researchPrompt: string
}

export const parseOutlineRequest = (body: unknown): OutlineRequest => {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid outline request')
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
  if (!firstContentSection(sections)) {
    throw new Error('Select a section other than References to outline')
  }
  return { paperId, paperType: rec.paperType, sections, researchPrompt }
}

export const generateOutlineDraft = async (opts: {
  paperType: string
  sections: string[]
  researchPrompt: string
  retrieve: OutlineRetrieve
  complete: OutlineComplete
}): Promise<{ outline: string }> => {
  const section = firstContentSection(opts.sections)
  if (!section) {
    throw new Error('Select a section other than References to outline')
  }
  const passages = await opts.retrieve(opts.paperType, section, opts.researchPrompt)
  const sources = numberSources(passages)
  const allowed = new Set(sources.map((source) => source.sid))
  const prompt = buildOutlinePrompt(
    opts.paperType,
    opts.sections,
    opts.researchPrompt,
    formatSourcesForPrompt(sources)
  )
  const raw = await opts.complete(prompt)
  return { outline: stripUnknownCitations(raw, allowed).trim() }
}
