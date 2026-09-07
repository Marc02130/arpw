import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Paper, PaperType, Status } from '../types'
import { supabase } from '../supabaseClient'
import { createDraftPaper, listPapers } from '../lib/papers'

type Counts = {
  literature: number
  primary: number
  examples: number
  papers: number
}

const empty: Counts = { literature: 0, primary: 0, examples: 0, papers: 0 }

const statusLabel = (status: string): string =>
  status === Status.COMPLETED ? 'Generated' : 'In progress'

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Counts>(empty)
  const [papers, setPapers] = useState<Paper[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<PaperType>(PaperType.EMPIRICAL_STUDY)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    try {
      const [literature, primary, examples, listed] = await Promise.all([
        supabase.from('references').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('source_role', 'literature'),
        supabase.from('references').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('source_role', 'primary'),
        supabase.from('examples').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        listPapers(supabase, user.id),
      ])
      const firstError = literature.error || primary.error || examples.error
      if (firstError) throw new Error(firstError.message)
      setPapers(listed)
      setCounts({
        literature: literature.count ?? 0,
        primary: primary.count ?? 0,
        examples: examples.count ?? 0,
        papers: listed.length,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleNewPaper = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      const paper = await createDraftPaper(supabase, user.id, {
        title: newTitle,
        paperType: newType,
      })
      navigate(`/generate?paper=${paper.paper_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start paper')
      setCreating(false)
    }
  }

  const cards = [
    { label: 'Papers', value: counts.papers, to: '/library', hint: 'Drafts and generated papers' },
    { label: 'Literature', value: counts.literature, to: '/generate/upload', hint: 'Published sources to cite' },
    { label: 'Original research', value: counts.primary, to: '/generate/upload', hint: 'Your work on this paper’s topic' },
    { label: 'Example papers', value: counts.examples, to: '/generate/upload', hint: 'Voice and style only' },
  ]

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Start a new paper or continue one in progress. Counts are for this account.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="card hover:border-primary-300 transition-colors">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-2">{card.hint}</p>
              </Link>
            ))}
          </div>

          <div className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">New paper</h2>
            <form onSubmit={(event) => void handleNewPaper(event)} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label htmlFor="new-paper-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  id="new-paper-title"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  className="input-field"
                  placeholder="Untitled paper"
                />
              </div>
              <div className="sm:w-56">
                <label htmlFor="new-paper-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  id="new-paper-type"
                  value={newType}
                  onChange={(event) => setNewType(event.target.value as PaperType)}
                  className="input-field"
                >
                  {Object.values(PaperType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary sm:mb-0" disabled={creating}>
                {creating ? 'Starting…' : 'Start paper'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your papers</h2>
            {papers.length === 0 ? (
              <p className="text-sm text-gray-500">No papers yet. Start one above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {papers.map((paper) => (
                      <tr key={paper.paper_id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{paper.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{paper.paper_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{statusLabel(paper.status)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(paper.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/generate?paper=${paper.paper_id}`}
                            className="text-sm font-medium text-primary-600 hover:text-primary-500"
                          >
                            Continue
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default HomePage
