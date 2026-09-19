/** Academic-paper chunk roles. Port of Ragged classify.py; default retrieve drops diary-style experience. */

export const CHUNK_ROLES = [
  'claim',
  'finding',
  'evaluation',
  'method',
  'context',
  'experience',
  'citation',
  'boilerplate',
] as const

export type ChunkRole = (typeof CHUNK_ROLES)[number]

export const ROLE_SPECS: Record<ChunkRole, string> = {
  claim:
    'What the author asserts, argues, hypothesizes, or believes. Opinions, theses, we propose, I think, editorial line, hypothesized mechanisms.',
  finding:
    'What is reported as observed or having happened: results, facts, events, measurements, we found, significantly increased, the court found, sales rose.',
  evaluation:
    'Judgment of strength or meaning: limitations, unconfirmed, strongest evidence, cannot establish causality, more research needed, conflicting reports.',
  method:
    'How it was done or known: instruments, protocol, HPLC, statistics, ANOVA, sample collection, interview method, GraphPad, inclusion criteria.',
  context:
    'Background the reader needs: setting, prior story, definitions, last year, literature narrative in the body, not a reference list.',
  experience:
    'First-person lived detail: diary, memoir, anecdote, I felt, I remember, travel notes.',
  citation:
    'Pointers to other works: bibliography, references, see Smith 2019, doi.org, http urls, et al author lists, footnote-only references.',
  boilerplate:
    'Funding, ads, page headers, acknowledgements, competing interests, data availability on request, cookie copy.',
}

/** Academic default: claims, findings, evaluation, and body context. Not diary experience. */
export const DEFAULT_RETRIEVE: ReadonlySet<ChunkRole> = new Set([
  'claim',
  'finding',
  'evaluation',
  'context',
])

export const EXCLUDE_DEFAULT: ReadonlySet<ChunkRole> = new Set(['citation', 'boilerplate'])

const DOI = /\bdoi\.org\b|\b10\.\d{4,}\//i
const ET_AL = /\bet al\.?\b/gi
const HTTP = /https?:\/\//gi
const PUBMED = /\[pubmed:|\bpmid:\s*\d+/i
const JOURNAL_CITE = /\b(j |mol |curr |aging |neurosci |alzheimer).{0,40}\d{4}[;:]/gi
const NUMBERED_REF_HEAD =
  /^\d+\s*\.?\s+[A-Z][A-Za-z\-]+.+(?:\d{4}|alzheimer|microbiome|gut)/i
const FIGURE_CAPTION =
  /\bfigure\s+\d+\b.*\b(illustrates|shows|flowchart|flow chart)\b/is
const ZWSP = /[\u200b\u200c\u200d\ufeff]/g

const JUNK_PHRASES = [
  'substantial contributions to the conception',
  'final approval of the version to be published',
  'agreement to be accountable for all aspects',
  'competing interests',
  'data availability',
  'acknowledgements',
  'informed consent',
  'ethics committee',
] as const

const SECTION_DEFAULT_ROLE: Record<string, ChunkRole> = {
  abstract: 'context',
  introduction: 'context',
  'literature review': 'context',
  methods: 'method',
  results: 'finding',
  discussion: 'evaluation',
  conclusion: 'claim',
  references: 'citation',
}

export const isChunkRole = (value: unknown): value is ChunkRole =>
  typeof value === 'string' && (CHUNK_ROLES as readonly string[]).includes(value)

const norm = (text: string): string => (text || '').replace(ZWSP, '').toLowerCase()

const countMatches = (pattern: RegExp, text: string): number => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  return [...text.matchAll(new RegExp(pattern.source, flags))].length
}

export const classifyChunk = (text: string, heading = ''): ChunkRole => {
  const blob = `${heading}\n${text}`
  const low = norm(blob)
  const head = norm(heading)

  if (['reference', 'bibliograph', 'works cited', 'literature cited'].some((k) => head.includes(k))) {
    return 'citation'
  }
  if (NUMBERED_REF_HEAD.test(heading.trim())) return 'citation'
  if (
    ['acknowledg', 'funding', 'competing interest', 'conflict of interest', 'data availability'].some((k) =>
      head.includes(k)
    )
  ) {
    return 'boilerplate'
  }
  if (DOI.test(blob) || DOI.test(low) || PUBMED.test(low)) return 'citation'
  if (countMatches(ET_AL, blob) >= 3 && text.length < 2500) return 'citation'
  if (low.startsWith('http') || (countMatches(HTTP, blob) >= 3 && !low.includes('we found'))) {
    return 'citation'
  }
  if (countMatches(JOURNAL_CITE, low) >= 2 && text.length < 2500) return 'citation'
  if (
    ['graphpad prism', 'bonferroni', 'kruskal-wallis', 'mann-whitney'].some((k) => low.includes(k)) &&
    !['we found', 'showed that', 'associated with'].some((k) => low.includes(k))
  ) {
    return 'method'
  }
  if (['i felt', 'i remember', 'dear diary', 'this morning i'].some((k) => low.includes(k))) {
    return 'experience'
  }
  if (['we hypothesize', 'we propose', 'it is hypothesized', 'we argue'].some((k) => low.includes(k))) {
    return 'claim'
  }
  if (['we found', 'was associated', 'significantly', 'these findings', 'showed that'].some((k) => low.includes(k))) {
    return 'finding'
  }
  if (['limitation', 'cannot establish', 'causal relationship cannot', 'further studies'].some((k) => low.includes(k))) {
    return 'evaluation'
  }

  const sectionRole = SECTION_DEFAULT_ROLE[head.trim()]
  if (sectionRole) return sectionRole

  const scores: Record<ChunkRole, number> = {
    claim: 0,
    finding: 0,
    evaluation: 0,
    method: 0,
    context: 0,
    experience: 0,
    citation: 0,
    boilerplate: 0,
  }
  for (const role of CHUNK_ROLES) {
    for (const word of ROLE_SPECS[role].toLowerCase().split(/\s+/)) {
      const token = word.replace(/^[.,;:]+|[.,;:]+$/g, '')
      if (token.length >= 5 && low.includes(token)) scores[role] += 1
    }
  }
  let best: ChunkRole = 'context'
  for (const role of CHUNK_ROLES) {
    if (scores[role] > scores[best]) best = role
  }
  return scores[best] >= 2 ? best : 'context'
}

/** Drop before embed: captions, author-contribution, page numbers. Keep bibliography for “what do they cite”. */
export const isJunkChunk = (text: string, heading = ''): boolean => {
  const piece = (text || '').trim()
  if (piece.length < 8) return true
  if (/^[\d\s.\-]+$/.test(piece)) return true
  const low = norm(`${heading}\n${piece}`)
  if (JUNK_PHRASES.some((phrase) => low.includes(phrase))) return true
  if (FIGURE_CAPTION.test(piece)) return true
  const words = piece.match(/[A-Za-z]{2,}/g) ?? []
  const digits = [...piece].filter((ch) => ch >= '0' && ch <= '9').length
  const digitRatio = digits / Math.max(piece.length, 1)
  if (digitRatio > 0.4 && words.length < 40) return true
  return false
}

export const classifyQuery = (question: string): ReadonlySet<ChunkRole> => {
  const q = norm(question)
  const roles = new Set<ChunkRole>()
  if (['evidence', 'finding', 'support', 'strongest', 'result', 'observ'].some((k) => q.includes(k))) {
    return new Set(['finding', 'evaluation', 'claim', 'context'])
  }
  if (['hypothes', 'mechanism', 'propos', 'theor', 'argue', 'claim'].some((k) => q.includes(k))) {
    roles.add('claim')
    roles.add('context')
    roles.add('evaluation')
  }
  if (
    [
      'instrument',
      'protocol',
      'method',
      'how did they',
      'how was',
      'assay',
      'hplc',
      'statistic',
      'sample size',
      'inclusion criteria',
      'exclusion criteria',
    ].some((k) => q.includes(k))
  ) {
    roles.add('method')
  }
  if (['i feel', 'i felt', 'my diary', 'anecdote'].some((k) => q.includes(k))) {
    roles.add('experience')
    roles.add('context')
  }
  if (
    ['reference', 'bibliograph', 'citation', 'cited', 'works cited', 'what do they cite'].some((k) => q.includes(k)) ||
    /\bdoi\b|\bpmid\b/.test(q)
  ) {
    roles.add('citation')
    roles.add('context')
  }
  if (['background', 'what is known', 'review the literature', 'literature review'].some((k) => q.includes(k))) {
    roles.add('context')
    roles.add('claim')
  }
  if (['limitation', 'weakness', 'caveat', 'further studies', 'cannot establish'].some((k) => q.includes(k))) {
    roles.add('evaluation')
    roles.add('context')
  }
  if (roles.size === 0) return DEFAULT_RETRIEVE
  return roles
}

export const preferredRoles = (question: string): ReadonlySet<ChunkRole> => {
  const wanted = classifyQuery(question)
  const includesExcluded = [...wanted].some((role) => EXCLUDE_DEFAULT.has(role))
  if (includesExcluded) return wanted
  const kept = new Set([...wanted].filter((role) => !EXCLUDE_DEFAULT.has(role)))
  return kept.size > 0 ? kept : DEFAULT_RETRIEVE
}

export const excludedRoles = (question: string): ReadonlySet<ChunkRole> => {
  const wanted = classifyQuery(question)
  const dropped = [...EXCLUDE_DEFAULT].filter((role) => !wanted.has(role))
  return new Set(dropped.filter((role) => role !== 'method' && role !== 'experience'))
}

export const allowedRoles = (question: string): ReadonlySet<ChunkRole> => preferredRoles(question)

export const resolveRole = (text: string, heading: string, stored: string | null | undefined): ChunkRole => {
  const live = classifyChunk(text, heading)
  if (EXCLUDE_DEFAULT.has(live)) return live
  if (isChunkRole(stored)) return stored
  return live
}

export type RoleLabeled = {
  chunk_text: string
  section?: string | null
  chunk_role?: string | null
}

/** Hard-drop citation/boilerplate unless asked; prefer query roles; else nearest allowed. */
export const filterPassagesForQuestion = <T extends RoleLabeled>(
  question: string,
  rows: T[]
): Array<T & { chunk_role: ChunkRole }> => {
  const excluded = excludedRoles(question)
  const preferred = preferredRoles(question)
  const labeled = rows.map((row) => ({
    ...row,
    chunk_role: resolveRole(row.chunk_text, row.section ?? '', row.chunk_role),
  }))
  const allowed = labeled.filter((row) => !excluded.has(row.chunk_role))
  const boosted = allowed.filter((row) => preferred.has(row.chunk_role))
  return boosted.length > 0 ? boosted : allowed
}
