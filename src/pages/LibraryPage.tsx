import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { loadPaperCitedFiles, referenceCountFromEmbed, type CitedFile } from '../lib/papers'
import { uncitedSentences } from '../lib/attribution'
import { citationCheckLabel, citationInputsFromAttribution, runCitationCheck } from '../lib/citationCheck'
import { Paper, LibraryPaper, VersionHistory } from '../types'

const LibraryPage: React.FC = () => {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<LibraryPaper[]>([])
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [selectedCitedFiles, setSelectedCitedFiles] = useState<CitedFile[]>([])
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    fetchPapers()
  }, [])

  const fetchPapers = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_papers')
        .select(`
          *,
          paper_references(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching papers:', error)
        return
      }

      // Group papers by title for version history
      const groupedPapers = data.reduce((acc: { [key: string]: Paper[] }, paper) => {
        if (!acc[paper.title]) {
          acc[paper.title] = []
        }
        acc[paper.title].push(paper)
        return acc
      }, {})

      const versionHistory: VersionHistory[] = Object.entries(groupedPapers).map(([title, versions]) => ({
        title,
        versions: versions.sort((a, b) => b.version - a.version)
      }))

      setVersionHistory(versionHistory)

      // Create library papers (latest version of each title)
      const libraryPapers: LibraryPaper[] = versionHistory.map(({ versions }) => {
        const latestVersion = versions[0]
        return {
          paper: latestVersion,
          referenceCount: referenceCountFromEmbed(
            (latestVersion as Paper & { paper_references?: Array<{ count?: number }> }).paper_references
          ),
          lastModified: latestVersion.created_at
        }
      })

      setPapers(libraryPapers)
    } catch (error) {
      console.error('Error fetching papers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm('Are you sure you want to delete this paper? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('user_papers')
        .delete()
        .eq('paper_id', paperId)

      if (error) {
        console.error('Error deleting paper:', error)
        alert('Error deleting paper')
        return
      }

      // Refresh the papers list
      fetchPapers()
    } catch (error) {
      console.error('Error deleting paper:', error)
      alert('Error deleting paper')
    }
  }

  const openPaper = (paperId: string) => {
    navigate(`/generate?paper=${paperId}`)
  }

  const openPreview = async (paper: Paper) => {
    setSelectedPaper(paper)
    try {
      setSelectedCitedFiles(await loadPaperCitedFiles(supabase, paper.paper_id))
    } catch {
      setSelectedCitedFiles([])
    }
  }

  const closePreview = () => {
    setSelectedPaper(null)
    setSelectedCitedFiles([])
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Paper Library</h1>
        <p className="mt-2 text-gray-600">
          Manage your generated research papers and view version history.
        </p>
      </div>

      {papers.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No papers yet</h3>
          <p className="text-gray-500 mb-4">
            Generate your first research paper to see it here.
          </p>
          <a href="/dashboard" className="btn-primary">
            Start a paper
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Papers List */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Your Papers</h2>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="btn-secondary text-sm"
              >
                {showVersions ? 'Hide Versions' : 'Show Versions'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sources
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {papers.map(({ paper, referenceCount }) => (
                    <tr key={paper.paper_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {paper.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          v{paper.version} • {paper.citation_style}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {paper.paper_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          paper.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {paper.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {referenceCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(paper.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => void openPreview(paper)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </button>
                        <Link
                          to={`/generate?paper=${paper.paper_id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Continue
                        </Link>
                        <button
                          onClick={() => handleDeletePaper(paper.paper_id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Version History */}
          {showVersions && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Version History</h2>
              <div className="space-y-4">
                {versionHistory.map(({ title, versions }) => (
                  <div key={title} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">{title}</h3>
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div key={version.paper_id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                          <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-gray-600">
                              v{version.version}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDate(version.created_at)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              version.status === 'completed' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {version.status}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => void openPreview(version)}
                              className="text-xs text-primary-600 hover:text-primary-900"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDeletePaper(version.paper_id)}
                              className="text-xs text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paper Preview Modal */}
      {selectedPaper && (() => {
        const uncited = uncitedSentences(selectedPaper.attribution ?? [])
        const citationCheck = runCitationCheck({
          content: selectedPaper.content ?? '',
          ...citationInputsFromAttribution(selectedPaper.content ?? '', selectedPaper.attribution ?? []),
          paperReferenceFileIds: selectedCitedFiles.map((file) => file.file_id),
        })
        return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedPaper.title} (v{selectedPaper.version})
              </h3>
              <button
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto border rounded p-4 bg-gray-50">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {selectedPaper.content || 'No draft yet.'}
              </pre>
              <p className={`mt-3 text-sm ${citationCheck.ok ? 'text-gray-700' : 'text-red-700'}`} role="status">
                {citationCheckLabel(citationCheck)}
              </p>
              {uncited.length > 0 && (
                <p className="mt-3 text-sm text-amber-800">
                  {uncited.length} uncited sentence{uncited.length === 1 ? '' : 's'}.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={closePreview}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => openPaper(selectedPaper.paper_id)}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

export default LibraryPage
