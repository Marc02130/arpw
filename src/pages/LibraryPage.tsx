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
  deletePaper,
  loadPaperCitedFiles,
  loadSourceCitations,
  paperSectionsOrDefault,
  referenceCountFromEmbed,
  type CitedFile,
  type SourceCitation,
} from '../lib/papers'
import {
  LIBRARY_PAGE_SIZE,
  clampPage,
  groupPapersByTitle,
  pageCount,
  slicePage,
} from '../lib/libraryPage'
import CitationField from '../components/CitationField'
import PaginationBar from '../components/PaginationBar'
import { uncitedSentences } from '../lib/attribution'
import { citationInputsFromAttribution, runCitationCheck } from '../lib/citationCheck'
import { runFormatCheck } from '../lib/formatCheck'
import DraftPreview from '../components/DraftPreview'
import { DocumentType, Paper, LibraryPaper, VersionHistory } from '../types'
import { deleteOwnedDocument } from '../lib/documentStore'

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
  const [sources, setSources] = useState<SourceCitation[]>([])
  const [papersPage, setPapersPage] = useState(1)
  const [sourcesPage, setSourcesPage] = useState(1)
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null)

  useEffect(() => {
    fetchPapers()
  }, [])

  const fetchPapers = async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      try {
        setSources(await loadSourceCitations(supabase, user.id))
      } catch {
        setSources([])
      }

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

      const versionHistory = groupPapersByTitle((data ?? []) as Paper[])
      setVersionHistory(versionHistory)

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

    setBusyId(paperId)
    setActionError(null)
    try {
      await deletePaper(supabase, paperId)
      if (selectedPaper?.paper_id === paperId) {
        setSelectedPaper(null)
        setSelectedCitedFiles([])
      }
      await fetchPapers({ quiet: true })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete paper')
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteSource = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return
    }
    setDeletingSourceId(fileId)
    setActionError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      await deleteOwnedDocument(supabase, user.id, DocumentType.REFERENCE, fileId)
      setSources((prev) => prev.filter((row) => row.file_id !== fileId))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete source')
    } finally {
      setDeletingSourceId(null)
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
      await fetchPapers({ quiet: true })
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

  const papersPageSafe = clampPage(papersPage, pageCount(papers.length))
  const papersOnPage = slicePage(papers, papersPageSafe)
  const titlesOnPage = new Set(papersOnPage.map((row) => row.paper.title))
  const versionsOnPage = versionHistory.filter((row) => titlesOnPage.has(row.title))
  const sourcesPageSafe = clampPage(sourcesPage, pageCount(sources.length))
  const sourcesOnPage = slicePage(sources, sourcesPageSafe)

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
          Manage generated papers and the preformatted citations stored with each uploaded source.
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
        <div className="card text-center py-12 mb-8">
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
        <div className="space-y-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Your Papers</h2>
              <button
                type="button"
                onClick={() => setShowVersions(!showVersions)}
                className="btn-secondary text-sm"
              >
                {showVersions ? 'Hide Versions' : 'Show Versions'}
              </button>
            </div>

            <ul className="divide-y divide-gray-200">
              {papersOnPage.map(({ paper, referenceCount }) => (
                <li key={paper.paper_id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{paper.title}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        v{paper.version} · {paper.paper_type} · {paper.status} · {referenceCount} sources · {formatDate(paper.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => void openPreview(paper)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </button>
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
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Link
                        to={`/generate?paper=${paper.paper_id}`}
                        className="btn-primary text-center"
                      >
                        Continue
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeletePaper(paper.paper_id)}
                        disabled={busyId === paper.paper_id}
                        aria-label={`Delete ${paper.title}`}
                        className="btn-danger"
                      >
                        {busyId === paper.paper_id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <PaginationBar
              label="Your papers pagination"
              page={papersPageSafe}
              total={papers.length}
              pageSize={LIBRARY_PAGE_SIZE}
              onPage={setPapersPage}
            />
          </div>

          {showVersions && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Version History</h2>
              <div className="space-y-4">
                {versionsOnPage.map(({ title, versions }) => (
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
                              type="button"
                              onClick={() => void handleDeletePaper(version.paper_id)}
                              disabled={busyId === version.paper_id}
                              aria-label={`Delete ${title} v${version.version}`}
                              className="btn-danger text-xs py-1 px-2"
                            >
                              {busyId === version.paper_id ? 'Deleting…' : 'Delete'}
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

      {sources.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Source citations</h2>
          <p className="text-sm text-gray-600 mb-4">
            Academic papers include a ready-to-paste citation (PubMed cite button, journal site, DOI).
            We fetch it on upload when a DOI is present. You can edit or add it here.
          </p>
          <ul className="space-y-5">
            {sourcesOnPage.map((source) => (
              <li key={source.file_id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="text-sm font-medium text-gray-900">{source.file_name}</p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSource(source.file_id, source.file_name)}
                    disabled={deletingSourceId === source.file_id}
                    aria-label={`Delete ${source.file_name}`}
                    className="btn-danger shrink-0 text-xs py-1 px-3"
                  >
                    {deletingSourceId === source.file_id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
                <CitationField
                  fileId={source.file_id}
                  fileName={source.file_name}
                  citationText={source.citation_text}
                  onSaved={(citationText) =>
                    setSources((prev) =>
                      prev.map((row) =>
                        row.file_id === source.file_id ? { ...row, citation_text: citationText } : row
                      )
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <PaginationBar
            label="Source citations pagination"
            page={sourcesPageSafe}
            total={sources.length}
            pageSize={LIBRARY_PAGE_SIZE}
            onPage={setSourcesPage}
          />
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
            {selectedCitedFiles.length > 0 && (
              <div className="mt-4 space-y-4">
                <h4 className="text-sm font-semibold text-gray-800">Cited sources</h4>
                {selectedCitedFiles.map((file) => (
                  <div key={file.file_id}>
                    <p className="text-xs text-gray-500 mb-1">{file.file_name}</p>
                    <CitationField
                      fileId={file.file_id}
                      fileName={file.file_name}
                      citationText={file.citation_text ?? null}
                      citationStyle={selectedPaper.citation_style}
                      onSaved={(citationText) =>
                        setSelectedCitedFiles((prev) =>
                          prev.map((row) =>
                            row.file_id === file.file_id ? { ...row, citation_text: citationText } : row
                          )
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
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
                type="button"
                onClick={() => void handleDeletePaper(selectedPaper.paper_id)}
                disabled={busyId === selectedPaper.paper_id}
                aria-label={`Delete ${selectedPaper.title}`}
                className="btn-danger"
              >
                {busyId === selectedPaper.paper_id ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
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
