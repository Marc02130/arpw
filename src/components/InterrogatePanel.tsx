import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { invokeInterrogateCorpus } from '../lib/interrogateClient'
import type { InterrogatePassage } from '../lib/interrogateCorpus'
import { PAPER_SECTIONS } from '../lib/generationTemplates'
import { pinForVector, type PinnedPassage } from '../lib/pins'
import type { InterrogateFilter } from '../lib/retrievePassages'
import { sourceRoleLabel } from '../lib/sourceRole'
import { supabase } from '../supabaseClient'

const FILTERS: Array<{ value: InterrogateFilter; label: string }> = [
  { value: 'both', label: 'Literature and original research' },
  { value: 'literature', label: 'Literature only' },
  { value: 'primary', label: 'Original research only' },
]

export type InterrogatePinTarget = {
  file_id: string
  vector_id: string
}

type InterrogatePanelProps = {
  paperId: string | null
  pins: PinnedPassage[]
  pinError: string | null
  onPin: (row: InterrogatePinTarget, targetSection: string | null) => Promise<void>
  onUnpin: (pinId: string) => Promise<void>
}

const InterrogatePanel: React.FC<InterrogatePanelProps> = ({
  paperId,
  pins,
  pinError,
  onPin,
  onUnpin,
}) => {
  const [question, setQuestion] = useState('')
  const [filterRole, setFilterRole] = useState<InterrogateFilter>('both')
  const [isAsking, setIsAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [passages, setPassages] = useState<InterrogatePassage[]>([])
  const [targets, setTargets] = useState<Record<string, string>>({})

  const handleAsk = async () => {
    if (!paperId) {
      setError('Start or continue a paper from the Dashboard first')
      return
    }
    if (!question.trim()) {
      setError('Enter a question')
      return
    }
    setIsAsking(true)
    setError(null)
    try {
      const result = await invokeInterrogateCorpus(supabase, {
        paperId,
        question,
        filterRole,
      })
      setAnswer(result.answer)
      setPassages(result.passages)
    } catch (err) {
      setAnswer('')
      setPassages([])
      setError(err instanceof Error ? err.message : 'Interrogation failed')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ask the corpus</h2>
          <p className="text-sm text-gray-600 mb-4">
            Answers use only retrieved literature and original research. Example papers are not searched.
            This turn is not saved. Pin a passage to include it when you generate (next slice).
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="interrogate-filter">
            Sources
          </label>
          <select
            id="interrogate-filter"
            value={filterRole}
            onChange={(event) => setFilterRole(event.target.value as InterrogateFilter)}
            className="input-field mb-4"
          >
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="input-field h-32 resize-none"
            placeholder="What did this study measure? Which papers discuss citation overlap?"
            aria-label="Interrogation question"
          />
        </div>
        {(error || pinError) && (
          <p className="text-sm text-red-700" role="alert">
            {error ?? pinError}{' '}
            {/Grok API key/i.test(error ?? '') && (
              <Link to="/profile" className="font-medium text-primary-600 hover:text-primary-500">
                Open Profile
              </Link>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleAsk()}
          disabled={isAsking || !question.trim() || !paperId}
          className="btn-primary w-full py-3 text-lg"
        >
          {isAsking ? 'Asking...' : 'Ask'}
        </button>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Answer</h2>
        <div className="bg-gray-50 rounded-lg p-4 min-h-32 mb-6">
          {isAsking && <p className="text-gray-500 text-center">Retrieving passages and asking Grok...</p>}
          {!isAsking && !answer && (
            <p className="text-gray-500 text-center">
              Ask a question. Retrieved passages for the answer appear below. Pin ones to include.
            </p>
          )}
          {!isAsking && answer && (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">{answer}</pre>
          )}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Passages for this answer</h2>
        <div className="bg-gray-50 rounded-lg p-4 min-h-48 space-y-2 max-h-96 overflow-y-auto">
          {!isAsking && passages.length === 0 && answer && (
            <p className="text-gray-500 text-center">No retrieved passages.</p>
          )}
          {passages.map((row) => {
            const existing = pinForVector(pins, row.vector_id)
            const target = targets[row.vector_id] ?? ''
            return (
              <div key={row.vector_id} className="text-sm text-gray-700 bg-white border border-gray-200 rounded p-2">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs text-gray-500">
                    [{row.sid}] {row.source_role === 'primary' ? sourceRoleLabel('primary') : sourceRoleLabel('literature')}
                    {Number.isFinite(row.score) ? ` · score ${row.score.toFixed(3)}` : ''}
                  </div>
                  {existing ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-500"
                      onClick={() => void onUnpin(existing.pin_id)}
                    >
                      Unpin
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-500"
                      onClick={() => void onPin(row, target || null)}
                      disabled={!paperId}
                    >
                      Pin
                    </button>
                  )}
                </div>
                {!existing && (
                  <label className="block text-xs text-gray-500 mb-2">
                    Target section
                    <select
                      value={target}
                      onChange={(event) =>
                        setTargets((prev) => ({ ...prev, [row.vector_id]: event.target.value }))
                      }
                      className="mt-1 input-field text-sm py-1"
                      aria-label={`Target section for ${row.sid}`}
                    >
                      <option value="">Any section</option>
                      {PAPER_SECTIONS.filter((section) => section !== 'References').map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {existing && (
                  <p className="text-xs text-gray-500 mb-1">
                    Pinned for {existing.target_section ?? 'any section'}
                  </p>
                )}
                {row.chunk_text.slice(0, 400)}
                {row.chunk_text.length > 400 ? '…' : ''}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default InterrogatePanel
