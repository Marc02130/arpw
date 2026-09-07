import React from 'react'
import type { SentenceAttribution } from '../lib/attribution'
import type { CitationCheckResult } from '../lib/citationCheck'
import { DRAFT_DISCLAIMER, markUncitedInDraft, previewWarnings } from '../lib/draftPreview'
import type { FormatCheckResult } from '../lib/formatCheck'

type DraftPreviewProps = {
  content: string
  uncited: SentenceAttribution[]
  citationCheck: CitationCheckResult | null
  formatCheck: FormatCheckResult | null
}

const DraftPreview: React.FC<DraftPreviewProps> = ({
  content,
  uncited,
  citationCheck,
  formatCheck,
}) => {
  const warnings = previewWarnings({ uncited, citationCheck, formatCheck })
  const segments = markUncitedInDraft(content || 'No draft yet.', uncited)

  return (
    <div>
      <div className="max-h-96 overflow-y-auto border rounded p-4 bg-gray-50">
        <pre className="whitespace-pre-wrap text-sm text-gray-800">
          {segments.map((segment, index) =>
            segment.warning ? (
              <mark
                key={index}
                className="bg-amber-100 text-amber-950 rounded px-0.5"
                title="Uncited sentence"
              >
                ⚠ {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            )
          )}
        </pre>
        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1" role="status">
            {warnings.map((warning, index) => (
              <li
                key={`${warning.kind}-${index}`}
                className={`text-sm rounded p-2 ${
                  warning.kind === 'uncited'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                ⚠ {warning.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-600 border-t border-gray-200 pt-2" role="note">
        {DRAFT_DISCLAIMER}
      </p>
    </div>
  )
}

export default DraftPreview
