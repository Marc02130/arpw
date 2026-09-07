const PaperType = {
  EMPIRICAL_STUDY: 'Empirical Study',
  LITERATURE_REVIEW: 'Literature Review',
  THEORETICAL_PAPER: 'Theoretical Paper',
  CASE_STUDY: 'Case Study',
} as const

type PaperType = (typeof PaperType)[keyof typeof PaperType]

export const PAPER_SECTIONS = [
  'Abstract',
  'Introduction',
  'Literature Review',
  'Methods',
  'Results',
  'Discussion',
  'Conclusion',
  'References',
] as const

export type PaperSection = (typeof PAPER_SECTIONS)[number]

export type RetrievalRole = 'literature' | 'primary' | 'both' | 'none'

export type SectionTemplate = {
  retrievalQuery: string
  instructions: string
  preferredSourceRole: RetrievalRole
}

const isPaperSection = (value: string): value is PaperSection =>
  (PAPER_SECTIONS as readonly string[]).includes(value)

const roleFor = (paperType: PaperType, section: PaperSection): RetrievalRole => {
  if (section === 'References') return 'none'
  if (paperType === PaperType.LITERATURE_REVIEW) return 'literature'
  if (section === 'Methods' || section === 'Results') return 'primary'
  if (section === 'Discussion' || section === 'Conclusion') return 'both'
  return 'literature'
}

const TEMPLATES: Record<PaperType, Record<PaperSection, Omit<SectionTemplate, 'preferredSourceRole'>>> = {
  [PaperType.EMPIRICAL_STUDY]: {
    Abstract:
      {
        retrievalQuery: 'Empirical study abstract: research question, sample, main numeric findings.',
        instructions:
          'Write a structured abstract for an empirical study. State the question, what was done, and the main results. Cite only retrieved source ids. Do not invent methods or numbers.',
      },
    Introduction:
      {
        retrievalQuery: 'Empirical study introduction: gap in prior work and why this study was run.',
        instructions:
          'Introduce an empirical study. Motivate the question from published literature. Do not report new results here. Cite only retrieved source ids.',
      },
    'Literature Review':
      {
        retrievalQuery: 'Published literature for an empirical study: prior findings, measures, debates.',
        instructions:
          'Synthesize published work that frames this empirical study. Do not describe this study’s protocol as if it were someone else’s paper. Cite only retrieved literature source ids.',
      },
    Methods:
      {
        retrievalQuery: 'This study methods: participants, materials, procedure, analysis plan.',
        instructions:
          'Write Methods for this empirical study from primary (this-study) passages. Describe what was done, not what other papers did. If a detail is missing, say so; do not invent n, instruments, or statistics. Cite only retrieved source ids.',
      },
    Results:
      {
        retrievalQuery: 'This study results: outcomes, tables, effects, descriptive statistics.',
        instructions:
          'Write Results for this empirical study from primary passages. Report only findings present in the retrieved set. No interpretation beyond the data. Cite only retrieved source ids.',
      },
    Discussion:
      {
        retrievalQuery: 'Empirical discussion: this study findings versus published literature.',
        instructions:
          'Discuss this study’s results against published work. Separate what this study found from what others found. Cite only retrieved source ids.',
      },
    Conclusion:
      {
        retrievalQuery: 'Empirical conclusion: takeaways, limits, next studies.',
        instructions:
          'Conclude the empirical study. Restate the question and what the retrieved evidence supports. Note limits. Cite only retrieved source ids.',
      },
    References:
      {
        retrievalQuery: '',
        instructions:
          'List only works that were cited in earlier sections via retrieved source ids. Do not add unread sources. Do not retrieve new chunks for this section.',
      },
  },
  [PaperType.LITERATURE_REVIEW]: {
    Abstract:
      {
        retrievalQuery: 'Literature review abstract: scope of the published corpus and synthesis claim.',
        instructions:
          'Write an abstract for a literature review. State the scope and the synthesis, not a new experiment. Cite only retrieved literature source ids.',
      },
    Introduction:
      {
        retrievalQuery: 'Literature review introduction: why this published body of work needs a synthesis.',
        instructions:
          'Introduce a literature review. Frame the debate in published work. Do not describe a methods protocol for a new study. Cite only retrieved literature source ids.',
      },
    'Literature Review':
      {
        retrievalQuery: 'Core published papers, themes, and disagreements for this review.',
        instructions:
          'Organize published findings by theme. Compare and contrast. Do not treat the user’s unpublished notes as citable literature. Cite only retrieved literature source ids.',
      },
    Methods:
      {
        retrievalQuery: 'Review methods: inclusion criteria, search terms, how sources were selected.',
        instructions:
          'Describe how this review selected published sources. This is a review protocol, not a lab experiment. Cite only retrieved literature source ids.',
      },
    Results:
      {
        retrievalQuery: 'Review findings: patterns and gaps across the included publications.',
        instructions:
          'Report patterns in the included publications. No new empirical measurements. Cite only retrieved literature source ids.',
      },
    Discussion:
      {
        retrievalQuery: 'Literature review discussion: implications of the published pattern.',
        instructions:
          'Discuss what the published corpus implies and where it is thin. Cite only retrieved literature source ids.',
      },
    Conclusion:
      {
        retrievalQuery: 'Literature review conclusion: synthesis and open questions in prior work.',
        instructions:
          'Conclude the review. No new data. Cite only retrieved literature source ids.',
      },
    References:
      {
        retrievalQuery: '',
        instructions:
          'List only works cited via retrieved source ids. Do not retrieve new chunks.',
      },
  },
  [PaperType.THEORETICAL_PAPER]: {
    Abstract:
      {
        retrievalQuery: 'Theoretical paper abstract: claim, constructs, and argument outline.',
        instructions:
          'Write an abstract for a theoretical paper. State the claim and the line of argument. Cite only retrieved source ids.',
      },
    Introduction:
      {
        retrievalQuery: 'Theoretical introduction: constructs, puzzle, and proposed account.',
        instructions:
          'Introduce the theoretical claim. Use literature to locate the puzzle. Cite only retrieved source ids.',
      },
    'Literature Review':
      {
        retrievalQuery: 'Theories and published accounts this argument builds on or rejects.',
        instructions:
          'Map prior theoretical accounts. Cite only retrieved literature source ids.',
      },
    Methods:
      {
        retrievalQuery: 'How the theoretical argument is structured: assumptions, cases, derivations.',
        instructions:
          'Explain how the argument is built (assumptions, cases, derivations). This is not a lab methods section. Cite only retrieved source ids.',
      },
    Results:
      {
        retrievalQuery: 'Implications or worked cases that follow from the theoretical claim.',
        instructions:
          'Show what follows from the claim. Do not invent empirical results. Cite only retrieved source ids.',
      },
    Discussion:
      {
        retrievalQuery: 'Theoretical discussion: limits of the account versus published alternatives.',
        instructions:
          'Discuss the account against alternatives in the retrieved literature. Cite only retrieved source ids.',
      },
    Conclusion:
      {
        retrievalQuery: 'Theoretical conclusion: claim restated and what would test it.',
        instructions:
          'Restate the claim and what would test it. Cite only retrieved source ids.',
      },
    References:
      {
        retrievalQuery: '',
        instructions:
          'List only works cited via retrieved source ids. Do not retrieve new chunks.',
      },
  },
  [PaperType.CASE_STUDY]: {
    Abstract:
      {
        retrievalQuery: 'Case study abstract: the case, setting, and what it illustrates.',
        instructions:
          'Write an abstract for a case study. Identify the case and the claim it supports. Cite only retrieved source ids.',
      },
    Introduction:
      {
        retrievalQuery: 'Case study introduction: why this case, in this setting.',
        instructions:
          'Introduce the case and why it matters. Cite only retrieved source ids.',
      },
    'Literature Review':
      {
        retrievalQuery: 'Published cases and theory this case study sits in.',
        instructions:
          'Place the case in published work. Cite only retrieved literature source ids.',
      },
    Methods:
      {
        retrievalQuery: 'Case study methods: case selection, sources, how evidence was gathered.',
        instructions:
          'Describe case selection and sources from primary (this-study) passages when present. Do not invent interviews or access. Cite only retrieved source ids.',
      },
    Results:
      {
        retrievalQuery: 'Case narrative and evidence from this study’s materials.',
        instructions:
          'Tell what the case shows using retrieved primary passages. Cite only retrieved source ids.',
      },
    Discussion:
      {
        retrievalQuery: 'Case discussion: this case versus published theory and other cases.',
        instructions:
          'Interpret the case against literature. Cite only retrieved source ids.',
      },
    Conclusion:
      {
        retrievalQuery: 'Case study conclusion: transferable lesson and limits of the case.',
        instructions:
          'State what transfers beyond this case and what does not. Cite only retrieved source ids.',
      },
    References:
      {
        retrievalQuery: '',
        instructions:
          'List only works cited via retrieved source ids. Do not retrieve new chunks.',
      },
  },
}

export const isKnownPaperType = (value: string): value is PaperType =>
  Object.prototype.hasOwnProperty.call(TEMPLATES, value)

export const getSectionTemplate = (paperType: string, section: string): SectionTemplate => {
  if (!isPaperSection(section)) {
    throw new Error(`Unknown paper section: ${section}`)
  }
  if (!isKnownPaperType(paperType)) {
    throw new Error(`Unknown paper type: ${paperType}`)
  }
  const body = TEMPLATES[paperType][section]
  if (!body) {
    throw new Error(`Missing template for ${paperType} / ${section}`)
  }
  return {
    ...body,
    preferredSourceRole: roleFor(paperType, section),
  }
}

export const buildRetrievalQuery = (
  paperType: string,
  section: string,
  researchPrompt: string
): string => {
  const template = getSectionTemplate(paperType, section)
  const topic = researchPrompt.trim()
  if (!template.retrievalQuery) return topic
  return topic ? `${template.retrievalQuery}\n${topic}` : template.retrievalQuery
}

export const buildGenerationPrompt = (
  paperType: string,
  section: string,
  researchPrompt: string
): string => {
  const template = getSectionTemplate(paperType, section)
  const topic = researchPrompt.trim()
  return topic
    ? `${template.instructions}\n\nResearch prompt:\n${topic}`
    : template.instructions
}
