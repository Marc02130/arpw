import { describe, expect, it } from 'vitest'
import { CitationStyle, OutputFormat, PaperType, Status, type Paper } from '../types'
import {
  LIBRARY_PAGE_SIZE,
  clampPage,
  groupPapersByTitle,
  pageCount,
  pageRangeLabel,
  slicePage,
} from './libraryPage'

const paper = (overrides: Partial<Paper> & Pick<Paper, 'paper_id' | 'title' | 'version'>): Paper => ({
  user_id: 'user-1',
  content: '',
  sections: [],
  paper_type: PaperType.LITERATURE_REVIEW,
  citation_style: CitationStyle.APA,
  output_format: OutputFormat.MARKDOWN,
  status: Status.COMPLETED,
  created_at: '2026-09-08T00:00:00.000Z',
  ...overrides,
})

describe('library paging (LIB-1)', () => {
  it('should use 25 rows per page', () => {
    expect(LIBRARY_PAGE_SIZE).toBe(25)
    expect(pageCount(0)).toBe(0)
    expect(pageCount(25)).toBe(1)
    expect(pageCount(26)).toBe(2)
    expect(pageCount(50)).toBe(2)
    expect(pageCount(51)).toBe(3)
  })

  it('should slice and clamp pages', () => {
    const items = Array.from({ length: 26 }, (_, i) => i + 1)
    expect(slicePage(items, 1)).toEqual(items.slice(0, 25))
    expect(slicePage(items, 2)).toEqual([26])
    expect(slicePage(items, 99)).toEqual([26])
    expect(slicePage([], 1)).toEqual([])
    expect(clampPage(0, 3)).toBe(1)
    expect(clampPage(8, 3)).toBe(3)
    expect(clampPage(2, 0)).toBe(1)
  })

  it('should label the visible range', () => {
    expect(pageRangeLabel(1, 0)).toBe('0 of 0')
    expect(pageRangeLabel(1, 10)).toBe('1–10 of 10')
    expect(pageRangeLabel(2, 26)).toBe('26–26 of 26')
    expect(pageRangeLabel(9, 26)).toBe('26–26 of 26')
  })

  it('should group versions by title with the newest version first', () => {
    const rows = [
      paper({ paper_id: 'b2', title: 'Beta', version: 2, created_at: '2026-09-08T12:00:00.000Z' }),
      paper({ paper_id: 'a1', title: 'Alpha', version: 1, created_at: '2026-09-08T11:00:00.000Z' }),
      paper({ paper_id: 'b1', title: 'Beta', version: 1, created_at: '2026-09-07T12:00:00.000Z' }),
    ]
    const grouped = groupPapersByTitle(rows)
    expect(grouped.map((row) => row.title)).toEqual(['Beta', 'Alpha'])
    expect(grouped[0].versions.map((row) => row.paper_id)).toEqual(['b2', 'b1'])
  })
})
