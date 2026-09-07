import { describe, expect, it } from 'vitest'
import { DRAFT_DISCLAIMER } from './draftPreview'
import {
  checksExportBlock,
  exportFileName,
  exportFileStem,
  paperToBlocks,
  paperToMarkdown,
} from './exportPaper'

describe('export paper (LIB-4)', () => {
  it('should sanitize download names', () => {
    expect(exportFileStem('  Citation Overlap!! ')).toBe('citation-overlap')
    expect(exportFileName('Citation Overlap', 2, 'md')).toBe('citation-overlap-v2.md')
    expect(exportFileName('???', 1, 'docx')).toBe('paper-v1.docx')
  })

  it('should put the disclaimer at the end of Markdown and Word blocks', () => {
    const paper = {
      title: 'Citation overlap',
      content: '## Methods\n\nWe measured overlap [S1].',
      version: 1,
    }
    const md = paperToMarkdown(paper, { checks: 'Checks:\n- Missing section heading: Results' })
    expect(md.startsWith('# Citation overlap')).toBe(true)
    expect(md).toContain('## Methods')
    expect(md).toContain('Checks:')
    expect(md.trim().endsWith(DRAFT_DISCLAIMER)).toBe(true)

    const blocks = paperToBlocks(paper)
    expect(blocks[0]).toEqual({ type: 'h1', text: 'Citation overlap' })
    expect(blocks.some((block) => block.type === 'h2' && block.text === 'Methods')).toBe(true)
    expect(blocks[blocks.length - 1]).toEqual({ type: 'paragraph', text: DRAFT_DISCLAIMER })
  })

  it('should summarize empty vs present checks', () => {
    expect(checksExportBlock([])).toMatch(/no citation/i)
    expect(checksExportBlock([{ message: 'Missing section heading: Results' }])).toContain(
      '- Missing section heading: Results'
    )
  })
})
