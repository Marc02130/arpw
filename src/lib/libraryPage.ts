import type { Paper, VersionHistory } from '../types'

export const LIBRARY_PAGE_SIZE = 25

export const pageCount = (total: number, pageSize = LIBRARY_PAGE_SIZE): number => {
  if (total <= 0 || pageSize <= 0) return 0
  return Math.ceil(total / pageSize)
}

export const clampPage = (page: number, totalPages: number): number => {
  if (totalPages <= 0) return 1
  return Math.min(Math.max(1, page), totalPages)
}

export const slicePage = <T>(items: T[], page: number, pageSize = LIBRARY_PAGE_SIZE): T[] => {
  const pages = pageCount(items.length, pageSize)
  const current = clampPage(page, pages)
  const start = (current - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export const pageRangeLabel = (page: number, total: number, pageSize = LIBRARY_PAGE_SIZE): string => {
  if (total <= 0) return '0 of 0'
  const pages = pageCount(total, pageSize)
  const current = clampPage(page, pages)
  const start = (current - 1) * pageSize + 1
  const end = Math.min(current * pageSize, total)
  return `${start}–${end} of ${total}`
}

/** Group rows already ordered newest-first. First-seen title order is the library table order. */
export const groupPapersByTitle = (papers: Paper[]): VersionHistory[] => {
  const order: string[] = []
  const grouped = new Map<string, Paper[]>()
  for (const paper of papers) {
    const existing = grouped.get(paper.title)
    if (!existing) {
      grouped.set(paper.title, [paper])
      order.push(paper.title)
    } else {
      existing.push(paper)
    }
  }
  return order.map((title) => ({
    title,
    versions: (grouped.get(title) ?? []).slice().sort((a, b) => b.version - a.version),
  }))
}
