import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RETRIEVE,
  ROLE_SPECS,
  allowedRoles,
  classifyChunk,
  classifyQuery,
  excludedRoles,
  filterPassagesForQuestion,
  isJunkChunk,
  preferredRoles,
  resolveRole,
} from './chunkRoles'

describe('academic chunk roles', () => {
  it('should describe every role', () => {
    for (const role of [
      'claim',
      'finding',
      'evaluation',
      'method',
      'context',
      'experience',
      'citation',
      'boilerplate',
    ] as const) {
      expect(ROLE_SPECS[role].length).toBeGreaterThan(40)
    }
  })

  it('should label a bibliography as citation', () => {
    const text =
      'Tetzlaff J, Altman DG (2009) Preferred reporting items for systematic reviews. ' +
      'https://doi.org/10.1371/journal.pmed.1000097 et al. et al. et al.'
    expect(classifyChunk(text, 'References')).toBe('citation')
    expect(isJunkChunk(text, 'References')).toBe(false)
  })

  it('should treat a zwsp DOI and numbered heading as citation even if stored as context', () => {
    const text =
      'and inflammation-driven pathogenesis of Alzheimer’s Disease— a critical ' +
      'review. Mol Neurobiol 56(3):1841–1851. https://\u200bdoi.\u200borg/\u200b10.\u200b1007/' +
      's12035-018-1188-4\n145. Jiang C, Li G (2017) The gut microbiota'
    const heading = '88.\t Loew EB, Sallis B, Tracy M, Haran JP (2023) The'
    expect(classifyChunk(text, heading)).toBe('citation')
    expect(resolveRole(text, heading, 'context')).toBe('citation')
  })

  it('should label a PubMed reference list as citation', () => {
    const text =
      '182. Vogt NM, et al. (2017) Gut microbiome alterations in Alzheimer’s disease. ' +
      'Sci Rep 7(1):13537. [PubMed: 29051531]'
    expect(classifyChunk(text, 'Alzheimer’s disease. J Neuroinflammation 16(1):108.')).toBe(
      'citation'
    )
  })

  it('should not label a review lede as citation', () => {
    const text =
      'Worldwide efforts continue to unravel the complex pathological pathways ' +
      'that lead to Alzheimer’s disease. The gut–brain–microbiome axis is emerging ' +
      'as a potential mechanism involved in Alzheimer’s disease pathogenesis.'
    expect(classifyChunk(text, 'Purpose of review')).not.toBe('citation')
  })

  it('should label stats-only methods as method', () => {
    const text =
      'Non-parametric data were examined using the Mann-Whitney U-test. ' +
      'Statistical analyses were performed using GraphPad Prism 8.0.'
    expect(classifyChunk(text, '')).toBe('method')
  })

  it('should use IMRaD section defaults for academic papers', () => {
    expect(classifyChunk('Twelve adults completed the protocol in a quiet room.', 'Methods')).toBe(
      'method'
    )
    expect(classifyChunk('Cytokine concentrations rose in the treatment arm.', 'Results')).toBe(
      'finding'
    )
  })

  it('should label hypotheses as claim and findings as finding', () => {
    expect(classifyChunk('We hypothesize that SCFAs alter blood-brain barrier integrity.')).toBe(
      'claim'
    )
    expect(classifyChunk('We found reduced Blautia was associated with elevated cytokines.')).toBe(
      'finding'
    )
  })

  it('should still classify first-person diary text as experience', () => {
    expect(classifyChunk('This morning I felt foggy after the trip.', 'Tuesday')).toBe('experience')
  })

  it('should keep evidence queries on findings and drop bibliography', () => {
    const roles = allowedRoles('what hypotheses have the best evidence')
    expect(roles.has('finding')).toBe(true)
    expect(roles.has('claim')).toBe(true)
    expect(roles.has('evaluation')).toBe(true)
    expect(roles.has('context')).toBe(true)
    expect(roles.has('citation')).toBe(false)
    expect(roles.has('boilerplate')).toBe(false)
  })

  it('should include context on a literature-evidence review question', () => {
    const question =
      'review the documents and the evidence supporting their hypotheses, ' +
      'what hypotheses have the strongest hypotheses'
    const roles = allowedRoles(question)
    expect(roles.has('context')).toBe(true)
    expect(roles.has('claim')).toBe(true)
    expect(roles.has('finding')).toBe(true)
    expect(roles.has('citation')).toBe(false)
  })

  it('should route instrumentation questions to method', () => {
    expect(allowedRoles('what HPLC instrumentation was used').has('method')).toBe(true)
    expect(preferredRoles('what HPLC instrumentation was used').has('method')).toBe(true)
  })

  it('should not hard-drop method on an evidence question', () => {
    const excluded = excludedRoles('what hypotheses have the best evidence')
    expect(excluded.has('method')).toBe(false)
    expect(excluded.has('experience')).toBe(false)
    expect(excluded.has('citation')).toBe(true)
  })

  it('should default academic retrieve without diary experience', () => {
    const roles = classifyQuery('tell me about this')
    expect([...roles].sort()).toEqual([...DEFAULT_RETRIEVE].sort())
    expect(roles.has('experience')).toBe(false)
  })

  it('should include citation when the question asks what the papers cite', () => {
    expect(allowedRoles('what do they cite in the references').has('citation')).toBe(true)
    expect(excludedRoles('what do they cite in the references').has('citation')).toBe(false)
  })

  it('should drop stored-context bibliography on an evidence question', () => {
    const review =
      'Worldwide efforts continue to unravel the complex pathological pathways ' +
      'that lead to Alzheimer’s disease. The gut–brain–microbiome axis is emerging ' +
      'as a potential mechanism involved in Alzheimer’s disease pathogenesis.'
    const bib =
      '182. Vogt NM, et al. (2017) Gut microbiome alterations in Alzheimer’s disease. ' +
      'Sci Rep 7(1):13537. [PubMed: 29051531] et al. et al.'
    const kept = filterPassagesForQuestion('what hypotheses have the strongest evidence', [
      { chunk_text: review, section: 'Introduction', chunk_role: 'context' },
      { chunk_text: bib, section: 'References', chunk_role: 'context' },
    ])
    expect(kept.some((row) => row.chunk_text.includes('gut–brain–microbiome'))).toBe(true)
    expect(kept.some((row) => row.chunk_text.includes('PubMed'))).toBe(false)
  })
})

describe('junk filter', () => {
  it('should drop ICMJE contribution text, figure captions, and page numbers', () => {
    const icmje =
      'Substantial contributions to the conception or design of the work, the ' +
      'acquisition, analysis, or interpretation of data for the work; final approval ' +
      'of the version to be published; and agreement to be accountable for all aspects ' +
      'of the work in ensuring that questions related to the accuracy or integrity.'
    expect(isJunkChunk(icmje)).toBe(true)
    expect(
      isJunkChunk(
        'Figure 2 illustrates the flowchart of the method used for selecting the research. Literature search was conducted'
      )
    ).toBe(true)
    expect(isJunkChunk('4')).toBe(true)
  })

  it('should keep a hypothesis paragraph', () => {
    const text =
      'We hypothesize that gut microbial metabolites including short-chain fatty acids ' +
      'alter blood-brain barrier integrity and thereby influence Alzheimer pathology.'
    expect(isJunkChunk(text)).toBe(false)
  })
})
