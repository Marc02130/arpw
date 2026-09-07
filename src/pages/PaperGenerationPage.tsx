import React, { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import {
  Paper,
  PaperGenerationConfig,
  PaperType,
  CitationStyle,
  OutputFormat,
  DocumentType,
  Status,
} from '../types'
import UploadZone from '../components/UploadZone'
import DocumentList from '../components/DocumentList'
import { EXAMPLE_FILE_CAP, REFERENCE_FILE_CAP } from '../lib/fileCap'
import { PAPER_SECTIONS } from '../lib/generationTemplates'
import { loadPaper, paperSectionsOrDefault, updatePaperConfig } from '../lib/papers'
import { retrieveForPaper, type RetrievedPassage } from '../lib/retrievePassages'
import { supabase } from '../supabaseClient'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `${isActive
    ? 'border-primary-500 text-primary-600'
    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} pb-2 px-1 border-b-2 text-sm font-medium`

const PaperGenerationPage: React.FC = () => {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const paperId = searchParams.get('paper')
  const uploadTab = location.pathname.endsWith('/upload')
  const paperQuery = paperId ? `?paper=${paperId}` : ''
  const [paper, setPaper] = useState<Paper | null>(null)
  const [paperError, setPaperError] = useState<string | null>(null)
  const [config, setConfig] = useState<PaperGenerationConfig>({
    prompt: '',
    sections: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion'],
    paper_type: PaperType.EMPIRICAL_STUDY,
    citation_style: CitationStyle.APA,
    output_format: OutputFormat.MARKDOWN,
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRetrieving, setIsRetrieving] = useState(false)
  const [retrieveError, setRetrieveError] = useState<string | null>(null)
  const [passages, setPassages] = useState<RetrievedPassage[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [listTick, setListTick] = useState(0)

  const bumpLists = () => setListTick((tick) => tick + 1)

  useEffect(() => {
    if (!paperId) {
      setPaper(null)
      setPaperError(null)
      return
    }
    void (async () => {
      try {
        const loaded = await loadPaper(supabase, paperId)
        setPaper(loaded)
        setPaperError(null)
        setConfig((prev) => ({
          ...prev,
          sections: paperSectionsOrDefault(loaded.sections),
          paper_type: loaded.paper_type,
          citation_style: loaded.citation_style,
          output_format: loaded.output_format,
        }))
      } catch (err) {
        setPaper(null)
        setPaperError(err instanceof Error ? err.message : 'Paper not found')
      }
    })()
  }, [paperId])

  const persistConfig = async (next: PaperGenerationConfig, title?: string) => {
    if (!paperId) return
    try {
      await updatePaperConfig(supabase, paperId, {
        title,
        sections: next.sections,
        paper_type: next.paper_type,
        citation_style: next.citation_style,
        output_format: next.output_format,
      })
    } catch (err) {
      setPaperError(err instanceof Error ? err.message : 'Could not save paper')
    }
  }

  const handleSectionToggle = (section: string) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        sections: prev.sections.includes(section)
          ? prev.sections.filter((name) => name !== section)
          : [...prev.sections, section],
      }
      void persistConfig(next)
      return next
    })
  }

  const handleUploadComplete = () => {
    setUploadSuccess('Files uploaded. Indexing may still fail until ingest is fixed.')
    setUploadError(null)
    bumpLists()
    setTimeout(() => setUploadSuccess(null), 5000)
  }

  const handleUploadError = (error: string) => {
    setUploadError(error)
    setUploadSuccess(null)
    setTimeout(() => setUploadError(null), 10000)
  }

  const handleRetrievePassages = async () => {
    if (!config.prompt.trim()) {
      setRetrieveError('Enter a research prompt')
      return
    }
    setIsRetrieving(true)
    setRetrieveError(null)
    try {
      const rows = await retrieveForPaper(
        supabase,
        config.paper_type,
        config.sections,
        config.prompt
      )
      setPassages(rows)
      if (rows.length === 0) {
        setRetrieveError('No passages matched. Upload and index files on the Upload tab.')
      }
    } catch (error) {
      setPassages([])
      setRetrieveError(error instanceof Error ? error.message : 'Retrieval failed')
    } finally {
      setIsRetrieving(false)
    }
  }

  const handleGenerate = async () => {
    if (!paperId) {
      alert('Start or continue a paper from the Dashboard first')
      return
    }
    if (!config.prompt.trim()) {
      alert('Please enter a research prompt')
      return
    }
    setIsGenerating(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert('Paper generation feature will be implemented in the next phase')
    } catch (error) {
      console.error('Error generating paper:', error)
      alert('Error generating paper. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Paper generation</h1>
        {paper ? (
          <p className="mt-2 text-gray-600">
            Working on <span className="font-medium text-gray-900">{paper.title}</span>
            {paper.status === Status.DRAFT ? ' (in progress)' : ' (generated)'}.{' '}
            <Link to="/dashboard" className="text-primary-600 hover:text-primary-500">
              Change paper
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-gray-600">
            Prompt a draft from your literature, original research, and optional style examples.
          </p>
        )}
      </div>

      {!paperId && (
        <div className="card mb-6">
          <p className="text-sm text-gray-700">
            Pick a paper on the{' '}
            <Link to="/dashboard" className="text-primary-600 hover:text-primary-500 font-medium">
              Dashboard
            </Link>{' '}
            (start new or continue an existing one). Uploads below are shared across papers.
          </p>
        </div>
      )}

      {paperError && (
        <p className="text-sm text-red-700 mb-4" role="alert">
          {paperError}
        </p>
      )}

      <div className="flex space-x-6 border-b border-gray-200 mb-6">
        <NavLink to={`/generate${paperQuery}`} end className={tabClass}>
          Prompt
        </NavLink>
        <NavLink to={`/generate/upload${paperQuery}`} className={tabClass}>
          Upload
        </NavLink>
      </div>

      {!uploadTab && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {paper && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Title</h2>
                <input
                  value={paper.title}
                  onChange={(event) => {
                    const title = event.target.value
                    setPaper({ ...paper, title })
                  }}
                  onBlur={() => void persistConfig(config, paper.title)}
                  className="input-field"
                  aria-label="Paper title"
                />
              </div>
            )}

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Research Prompt</h2>
              <textarea
                value={config.prompt}
                onChange={(e) => setConfig((prev) => ({ ...prev, prompt: e.target.value }))}
                className="input-field h-32 resize-none"
                placeholder="Describe your research topic, objectives, and any specific requirements..."
              />
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Paper Sections</h2>
              <div className="grid grid-cols-2 gap-2">
                {PAPER_SECTIONS.map((section) => (
                  <label key={section} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.sections.includes(section)}
                      onChange={() => handleSectionToggle(section)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{section}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Paper Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Paper Type</label>
                  <select
                    value={config.paper_type}
                    onChange={(e) => {
                      const paper_type = e.target.value as PaperType
                      setConfig((prev) => {
                        const next = { ...prev, paper_type }
                        void persistConfig(next)
                        return next
                      })
                    }}
                    className="input-field"
                  >
                    {Object.values(PaperType).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Citation Style</label>
                  <select
                    value={config.citation_style}
                    onChange={(e) => {
                      const citation_style = e.target.value as CitationStyle
                      setConfig((prev) => {
                        const next = { ...prev, citation_style }
                        void persistConfig(next)
                        return next
                      })
                    }}
                    className="input-field"
                  >
                    {Object.values(CitationStyle).map((style) => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Output Format</label>
                  <select
                    value={config.output_format}
                    onChange={(e) => {
                      const output_format = e.target.value as OutputFormat
                      setConfig((prev) => {
                        const next = { ...prev, output_format }
                        void persistConfig(next)
                        return next
                      })
                    }}
                    className="input-field"
                  >
                    {Object.values(OutputFormat).map((format) => (
                      <option key={format} value={format}>
                        {format.charAt(0).toUpperCase() + format.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleRetrievePassages()}
              disabled={isRetrieving || !config.prompt.trim()}
              className="btn-secondary w-full py-3 text-lg"
            >
              {isRetrieving ? 'Retrieving...' : 'Show passages'}
            </button>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !config.prompt.trim() || !paperId}
              className="btn-primary w-full py-3 text-lg"
            >
              {isGenerating ? 'Generating...' : 'Generate Paper'}
            </button>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Passages for this prompt</h2>
            {retrieveError && (
              <p className="text-sm text-red-700 mb-3" role="alert">{retrieveError}</p>
            )}
            <div className="bg-gray-50 rounded-lg p-4 min-h-48 space-y-4 max-h-96 overflow-y-auto">
              {isRetrieving && <p className="text-gray-500 text-center">Retrieving passages...</p>}
              {!isRetrieving && passages.length === 0 && !retrieveError && (
                <p className="text-gray-500 text-center">
                  Enter a research prompt and click Show passages. Generate is still a stub.
                </p>
              )}
              {!isRetrieving &&
                PAPER_SECTIONS.filter((section) => passages.some((row) => row.paperSection === section)).map(
                  (section) => (
                    <div key={section}>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">{section}</h3>
                      <ul className="space-y-2">
                        {passages
                          .filter((row) => row.paperSection === section)
                          .map((row) => (
                            <li
                              key={row.vector_id}
                              className="text-sm text-gray-700 bg-white border border-gray-200 rounded p-2"
                            >
                              <div className="text-xs text-gray-500 mb-1">
                                {row.source_role} · score {row.score.toFixed(3)}
                              </div>
                              {row.chunk_text.slice(0, 400)}
                              {row.chunk_text.length > 400 ? '…' : ''}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )
                )}
            </div>
          </div>
        </div>
      )}

      {uploadTab && (
        <div className="space-y-6">
          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <p className="text-sm font-medium">{uploadError}</p>
            </div>
          )}
          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg" role="alert">
              <p className="text-sm font-medium">{uploadSuccess}</p>
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Literature</h2>
            <p className="text-sm text-gray-600 mb-4">
              Published papers you will cite. Shares the {REFERENCE_FILE_CAP}-file cap with original research.
            </p>
            <UploadZone
              documentType={DocumentType.REFERENCE}
              sourceRole="literature"
              maxFiles={REFERENCE_FILE_CAP}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
            <div className="mt-6">
              <DocumentList
                documentType={DocumentType.REFERENCE}
                sourceRole="literature"
                heading="Literature"
                refreshKey={listTick}
                onDocumentDeleted={bumpLists}
                onRoleChanged={bumpLists}
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Original research</h2>
            <p className="text-sm text-gray-600 mb-4">
              Your own research on this paper’s topic (protocols, results, manuscript). Methods and Results retrieve here first. Shares the {REFERENCE_FILE_CAP}-file cap with literature. Not other people’s published papers.
            </p>
            <UploadZone
              documentType={DocumentType.REFERENCE}
              sourceRole="primary"
              maxFiles={REFERENCE_FILE_CAP}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
            <div className="mt-6">
              <DocumentList
                documentType={DocumentType.REFERENCE}
                sourceRole="primary"
                heading="Original research"
                refreshKey={listTick}
                onDocumentDeleted={bumpLists}
                onRoleChanged={bumpLists}
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Example papers</h2>
            <p className="text-sm text-gray-600 mb-4">
              Up to {EXAMPLE_FILE_CAP} papers for voice and structure only. Never used as evidence.
            </p>
            <UploadZone
              documentType={DocumentType.EXAMPLE}
              maxFiles={EXAMPLE_FILE_CAP}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
            <div className="mt-6">
              <DocumentList
                documentType={DocumentType.EXAMPLE}
                heading="Example papers"
                refreshKey={listTick}
                onDocumentDeleted={bumpLists}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaperGenerationPage
