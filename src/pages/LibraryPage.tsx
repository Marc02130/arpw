import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { invokeGeneratePaper } from '../lib/generatePaperClient'
import { previewWarnings } from '../lib/draftPreview'
import {
  checksExportBlock,
  downloadBlob,
  exportFileName,
  paperToDocxBlob,
  paperToMarkdown,
} from '../lib/exportPaper'
import {
  createRegenerateDraft,
  loadPaperCitedFiles,
  paperSectionsOrDefault,
  referenceCountFromEmbed,
  type CitedFile,
} from '../lib/papers'
import { uncitedSentences } from '../lib/attribution'
import { citationInputsFromAttribution, runCitationCheck } from '../lib/citationCheck'
import { runFormatCheck } from '../lib/formatCheck'
import DraftPreview from '../components/DraftPreview'
import { Paper, LibraryPaper, VersionHistory } from '../types'

const LibraryPage: React.FC = () => {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<LibraryPaper[]>([])
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [selectedCitedFiles, setSelectedCitedFiles] = useState<CitedFile[]>([])
  const [showVersions, setShowVersions] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  const handleRegenerate = async (paper: Paper) => {
    if (!paper.research_prompt?.trim()) {
      setActionError('This paper has no research prompt. Continue to add one, then generate.')
      return
    }
    setBusyId(paper.paper_id)
    setActionError(null)
    let createdId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const next = await createRegenerateDraft(supabase, user.id, paper)
      createdId = next.paper_id
      await invokeGeneratePaper(supabase, {
        paperId: next.paper_id,
        paperType: next.paper_type,
        sections: paperSectionsOrDefault(next.sections),
        researchPrompt: next.research_prompt ?? '',
        citationStyle: next.citation_style,
        outputFormat: next.output_format,
      })
      await fetchPapers()
    } catch (error) {
      if (createdId) {
        await supabase.from('user_papers').delete().eq('paper_id', createdId)
      }
      setActionError(error instanceof Error ? error.message : 'Regenerate failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleExport = async (paper: Paper, format: 'markdown' | 'word') => {
    setActionError(null)
    try {
      const cited = await loadPaperCitedFiles(supabase, paper.paper_id)
      const uncited = uncitedSentences(paper.attribution ?? [])
      const citationCheck = runCitationCheck({
        content: paper.content ?? '',
        ...citationInputsFromAttribution(paper.content ?? '', paper.attribution ?? []),
        paperReferenceFileIds: cited.map((file) => file.file_id),
      })
      const formatCheck = runFormatCheck({
        content: paper.content ?? '',
        requiredSections: paper.sections ?? [],
      })
      const checks = checksExportBlock(previewWarnings({ uncited, citationCheck, formatCheck }))
      const payload = { title: paper.title, content: paper.content ?? '', version: paper.version }
      if (format === 'markdown') {
        const text = paperToMarkdown(payload, { checks })
        downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), exportFileName(paper.title, paper.version, 'md'))
        return
      }
      const blob = await paperToDocxBlob(payload, { checks })
      downloadBlob(blob, exportFileName(paper.title, paper.version, 'docx'))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Export failed')
    }
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
        {actionError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {actionError}{' '}
            {/Grok API key/i.test(actionError) && (
              <Link to="/profile" className="font-medium text-primary-600 hover:text-primary-500">
                Open Profile
              </Link>
            )}
          </p>
        )}
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
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <button
                            type="button"
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
                            type="button"
                            onClick={() => void handleRegenerate(paper)}
                            disabled={busyId === paper.paper_id}
                            className="text-primary-600 hover:text-primary-900 disabled:text-gray-400"
                          >
                            {busyId === paper.paper_id ? 'Regenerating…' : 'Regenerate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExport(paper, 'markdown')}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            Markdown
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExport(paper, 'word')}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            Word
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePaper(paper.paper_id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
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
        const formatCheck = runFormatCheck({
          content: selectedPaper.content ?? '',
          requiredSections: selectedPaper.sections ?? [],
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
            <DraftPreview
              content={selectedPaper.content || 'No draft yet.'}
              uncited={uncited}
              citationCheck={citationCheck}
              formatCheck={formatCheck}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleExport(selectedPaper, 'markdown')}
                className="btn-secondary"
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => void handleExport(selectedPaper, 'word')}
                className="btn-secondary"
              >
                Word
              </button>
              <button
                type="button"
                onClick={() => void handleRegenerate(selectedPaper)}
                disabled={busyId === selectedPaper.paper_id}
                className="btn-secondary"
              >
                {busyId === selectedPaper.paper_id ? 'Regenerating…' : 'Regenerate'}
              </button>
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
