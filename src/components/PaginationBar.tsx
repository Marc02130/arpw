import React from 'react'
import { clampPage, pageCount, pageRangeLabel } from '../lib/libraryPage'

type PaginationBarProps = {
  label: string
  page: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}

const PaginationBar: React.FC<PaginationBarProps> = ({ label, page, total, pageSize, onPage }) => {
  if (total <= 0) return null
  const pages = pageCount(total, pageSize)
  const current = clampPage(page, pages)
  return (
    <nav className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" aria-label={label}>
      <p className="text-sm text-gray-600">Showing {pageRangeLabel(current, total, pageSize)}</p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
            disabled={current <= 1}
            onClick={() => onPage(current - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {current} of {pages}
          </span>
          <button
            type="button"
            className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
            disabled={current >= pages}
            onClick={() => onPage(current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  )
}

export default PaginationBar
