import React, { useEffect, useRef, useState } from 'react'
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
import InterrogatePanel, { type InterrogatePinTarget } from '../components/InterrogatePanel'
import DraftPreview from '../components/DraftPreview'
import { EXAMPLE_FILE_CAP, REFERENCE_FILE_CAP } from '../lib/fileCap'
import { uncitedSentences, type SentenceAttribution } from '../lib/attribution'
import { citationInputsFromAttribution, runCitationCheck } from '../lib/citationCheck'
import { runFormatCheck } from '../lib/formatCheck'
import { invokeGeneratePaper } from '../lib/generatePaperClient'
import { PAPER_SECTIONS } from '../lib/generationTemplates'
import {
  isVectorPinned,
  loadPins,
  pinForVector,
  pinPassage,
  unpinPassage,
  type PinnedPassage,
} from '../lib/pins'
import {
  loadCitedFiles,
  loadCorpusCounts,
  loadPaper,
  loadPaperCitedFiles,
  paperConfigIsHydrated,
  paperSectionsOrDefault,
  updatePaperConfig,
  type CitedFile,
  type CorpusCounts,
} from '../lib/papers'
import {
  retrieveExamplesForPaper,
  retrieveForPaper,
  type RetrievedPassage,
} from '../lib/retrievePassages'
import { supabase } from '../supabaseClient'
import { clientQueryEmbed } from '../lib/embedTextClient'
import {
  GENERATE_BUTTON_ID,
  GENERATE_CITATION_STYLE_ID,
  GENERATE_OUTPUT_FORMAT_ID,
  GENERATE_PAPER_TYPE_ID,
  GENERATE_PROMPT_ID,
  QUERY_SOURCES_BUTTON_ID,
} from '../lib/keyboardFlows'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `${isActive
    ? 'border-primary-500 text-primary-600'
    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} pb-2 px-1 border-b-2 text-sm font-medium`

const PaperGenerationPage: React.FC = () => {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const paperId = searchParams.get('paper')
  const uploadTab = location.pathname.endsWith('/upload')
  const interrogateTab = location.pathname.endsWith('/interrogate')
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
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [draft, setDraft] = useState<string>('')
  const [attribution, setAttribution] = useState<SentenceAttribution[]>([])
  const [passages, setPassages] = useState<RetrievedPassage[]>([])
  const [stylePassages, setStylePassages] = useState<RetrievedPassage[]>([])
  const [citedFiles, setCitedFiles] = useState<CitedFile[]>([])
  const [corpus, setCorpus] = useState<CorpusCounts>({ literature: 0, primary: 0, examples: 0 })
  const [pins, setPins] = useState<PinnedPassage[]>([])
  const [pinsReady, setPinsReady] = useState(!paperId)
  const [pinError, setPinError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [listTick, setListTick] = useState(0)

  const configRef = useRef(config)
  configRef.current = config
  const paperRef = useRef(paper)
  paperRef.current = paper
  const formHydrated = !paperId || paperConfigIsHydrated(paper, paperId)
  const bumpLists = () => setListTick((tick) => tick + 1)
  const uncited = uncitedSentences(attribution)
  const citationCheck = draft
    ? runCitationCheck({
        content: draft,
        ...citationInputsFromAttribution(draft, attribution),
        paperReferenceFileIds: citedFiles.map((file) => file.file_id),
      })
    : null
  const formatCheck = draft
    ? runFormatCheck({
        content: draft,
        requiredSections: config.sections,
      })
    : null

  useEffect(() => {
    if (!paperId) {
      setPaper(null)
      setPaperError(null)
      setDraft('')
      setAttribution([])
      setPassages([])
      setStylePassages([])
      setCitedFiles([])
      setPins([])
      setPinsReady(true)
      setPinError(null)
      return
    }
    setPinsReady(false)
    void (async () => {
      try {
        const loaded = await loadPaper(supabase, paperId)
        setPaper(loaded)
        setPaperError(null)
        setDraft(loaded.content?.trim() ? loaded.content : '')
        setAttribution(Array.isArray(loaded.attribution) ? loaded.attribution : [])
        setConfig((prev) => ({
          ...prev,
          prompt: loaded.research_prompt ?? '',
          sections: paperSectionsOrDefault(loaded.sections),
          paper_type: loaded.paper_type,
          citation_style: loaded.citation_style,
          output_format: loaded.output_format,
        }))
        try {
          setCitedFiles(await loadPaperCitedFiles(supabase, paperId))
        } catch {
          setCitedFiles([])
        }
        try {
          setPins(await loadPins(supabase, paperId))
          setPinError(null)
        } catch (err) {
          setPins([])
          setPinError(err instanceof Error ? err.message : 'Could not load pins')
        } finally {
          setPinsReady(true)
        }
      } catch (err) {
        setPaper(null)
        setPaperError(err instanceof Error ? err.message : 'Paper not found')
        setPinsReady(true)
      }
    })()
  }, [paperId])

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        setCorpus(await loadCorpusCounts(supabase, user.id))
      } catch {
        /* counts are advisory */
      }
    })()
  }, [listTick, uploadTab])

  const persistConfig = async (next: PaperGenerationConfig, title?: string) => {
    if (!paperConfigIsHydrated(paperRef.current, paperId) || !paperId) return
    try {
      await updatePaperConfig(supabase, paperId, {
        title,
        sections: next.sections,
        paper_type: next.paper_type,
        citation_style: next.citation_style,
        output_format: next.output_format,
        research_prompt: next.prompt,
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
    setUploadSuccess('Files uploaded. Indexing runs in the background.')
    setUploadError(null)
    bumpLists()
    setTimeout(() => setUploadSuccess(null), 5000)
  }

  const handleUploadError = (error: string) => {
    setUploadError(error)
    setUploadSuccess(null)
    setTimeout(() => setUploadError(null), 10000)
  }

  const refreshPins = async () => {
    if (!paperId) {
      setPins([])
      return
    }
    setPins(await loadPins(supabase, paperId))
  }

  const handlePinPassage = async (row: InterrogatePinTarget, targetSection?: string | null) => {
    if (!paperId) {
      setPinError('Start or continue a paper from the Dashboard first')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setPinError(null)
    try {
      await pinPassage(supabase, user.id, {
        paperId,
        fileId: row.file_id,
        vectorId: row.vector_id,
        targetSection: targetSection ?? null,
      })
      await refreshPins()
    } catch (error) {
      if (error instanceof Error && error.message === 'Already pinned') {
        await refreshPins()
        return
      }
      setPinError(error instanceof Error ? error.message : 'Could not pin passage')
    }
  }

  const handleUnpin = async (pinId: string) => {
    setPinError(null)
    try {
      await unpinPassage(supabase, pinId)
      await refreshPins()
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Could not unpin')
    }
  }

  const handleRetrievePassages = async () => {
    if (!config.prompt.trim()) {
      setRetrieveError('Enter a research prompt')
      return
    }
    setIsRetrieving(true)
    setRetrieveError(null)
    try {
      const [evidence, examples] = await Promise.all([
        retrieveForPaper(supabase, config.paper_type, config.sections, config.prompt, {
          paperId: paperId ?? undefined,
          embed: clientQueryEmbed(supabase),
        }),
        retrieveExamplesForPaper(
          supabase,
          config.paper_type,
          config.sections,
          config.prompt,
          undefined,
          clientQueryEmbed(supabase)
        ),
      ])
      setPassages(evidence)
      setStylePassages(examples)
      if (evidence.length === 0 && examples.length === 0) {
        setRetrieveError('No passages matched. Upload and index files on the Upload tab.')
      }
    } catch (error) {
      setPassages([])
      setStylePassages([])
      setRetrieveError(error instanceof Error ? error.message : 'Retrieval failed')
    } finally {
      setIsRetrieving(false)
    }
  }

  const handleGenerate = async () => {
    if (!paperId || !paper) {
      setGenerateError('Start or continue a paper from the Dashboard first')
      return
    }
    if (!config.prompt.trim()) {
      setGenerateError('Enter a research prompt')
      return
    }
    if (config.sections.length === 0) {
      setGenerateError('Select at least one section')
      return
    }
    setIsGenerating(true)
    setGenerateError(null)
    try {
      await persistConfig(config, paper?.title)
      const result = await invokeGeneratePaper(supabase, {
        paperId,
        paperType: config.paper_type,
        sections: config.sections,
        researchPrompt: config.prompt,
        citationStyle: config.citation_style,
        outputFormat: config.output_format,
      })
      setDraft(result.content)
      setAttribution(result.attribution)
      setCitedFiles(await loadCitedFiles(supabase, result.citedFileIds))
      const loaded = await loadPaper(supabase, paperId)
      setPaper(loaded)
      if (Array.isArray(loaded.attribution)) setAttribution(loaded.attribution)
      const [evidence, examples] = await Promise.all([
        retrieveForPaper(supabase, config.paper_type, config.sections, config.prompt, {
          paperId: paperId ?? undefined,
          embed: clientQueryEmbed(supabase),
        }),
        retrieveExamplesForPaper(
          supabase,
          config.paper_type,
          config.sections,
          config.prompt,
          undefined,
          clientQueryEmbed(supabase)
        ),
      ])
      setPassages(evidence)
      setStylePassages(examples)
    } catch (error) {
      setDraft('')
      setAttribution([])
      setCitedFiles([])
      setGenerateError(error instanceof Error ? error.message : 'Paper generation failed')
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
        <NavLink to={`/generate/interrogate${paperQuery}`} className={tabClass}>
          Interrogate
        </NavLink>
      </div>

      {interrogateTab && (
        <InterrogatePanel
          paperId={paperId}
          pins={pins}
          pinError={pinError}
          onPin={handlePinPassage}
          onUnpin={handleUnpin}
        />
      )}

      {!uploadTab && !interrogateTab && (
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
                  onBlur={() => void persistConfig(configRef.current, paper.title)}
                  className="input-field"
                  aria-label="Paper title"
                />
              </div>
            )}

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                <label htmlFor={GENERATE_PROMPT_ID}>Research Prompt</label>
              </h2>
              <textarea
                id={GENERATE_PROMPT_ID}
                value={config.prompt}
                onChange={(e) => setConfig((prev) => ({ ...prev, prompt: e.target.value }))}
                onBlur={() => void persistConfig(configRef.current, paper?.title)}
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
                      disabled={!formHydrated}
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
                  <label htmlFor={GENERATE_PAPER_TYPE_ID} className="block text-sm font-medium text-gray-700 mb-2">
                    Paper Type
                  </label>
                  <select
                    id={GENERATE_PAPER_TYPE_ID}
                    value={config.paper_type}
                    disabled={!formHydrated}
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
                  <label htmlFor={GENERATE_CITATION_STYLE_ID} className="block text-sm font-medium text-gray-700 mb-2">
                    Citation Style
                  </label>
                  <select
                    id={GENERATE_CITATION_STYLE_ID}
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
                  <label htmlFor={GENERATE_OUTPUT_FORMAT_ID} className="block text-sm font-medium text-gray-700 mb-2">
                    Output Format
                  </label>
                  <select
                    id={GENERATE_OUTPUT_FORMAT_ID}
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
              id={QUERY_SOURCES_BUTTON_ID}
              onClick={() => void handleRetrievePassages()}
              disabled={isRetrieving || !config.prompt.trim() || !formHydrated}
              aria-busy={isRetrieving}
              className="btn-secondary w-full py-3 text-lg"
            >
              {isRetrieving ? 'Querying...' : 'Query sources'}
            </button>
            {generateError && (
              <p className="text-sm text-red-700" role="alert">
                {generateError}{' '}
                {/Grok API key/i.test(generateError) && (
                  <Link to="/profile" className="font-medium text-primary-600 hover:text-primary-500">
                    Open Profile
                  </Link>
                )}
              </p>
            )}
            <button
              type="button"
              id={GENERATE_BUTTON_ID}
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !config.prompt.trim() || !paperId || !formHydrated}
              aria-busy={isGenerating}
              className="btn-primary w-full py-3 text-lg"
            >
              {isGenerating ? 'Generating...' : 'Generate Paper'}
            </button>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Your corpus</h2>
            <p className="text-sm text-gray-600 mb-4">
              {corpus.literature} literature · {corpus.primary} original research · {corpus.examples} example
              {corpus.examples === 1 ? '' : 's'}.{' '}
              <Link to={`/generate/upload${paperQuery}`} className="text-primary-600 hover:text-primary-500">
                Upload
              </Link>
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Pinned passages</h2>
            <p className="text-sm text-gray-600 mb-3">
              Generate and Query sources put these first. Unpin anytime. Pin from queried sources or Interrogate.
            </p>
            {pinError && (
              <p className="text-sm text-red-700 mb-3" role="alert">{pinError}</p>
            )}
            {!paperId && (
              <p className="text-sm text-gray-500 mb-4">Pick a paper on the Dashboard to pin passages.</p>
            )}
            {paperId && !pinsReady && (
              <p className="text-sm text-gray-500 mb-4">Loading pins...</p>
            )}
            {paperId && pinsReady && pins.length === 0 && (
              <p className="text-sm text-gray-500 mb-4">
                No pins yet. Query sources or Interrogate, then pin a literature or original-research chunk.
              </p>
            )}
            {pins.length > 0 && (
              <ul className="mb-6 space-y-2 max-h-56 overflow-y-auto">
                {pins.map((pin) => (
                  <li
                    key={pin.pin_id}
                    className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">
                          {pin.file_name} · {pin.target_section ?? 'any section'}
                        </div>
                        {pin.chunk_text.slice(0, 240)}
                        {pin.chunk_text.length > 240 ? '…' : ''}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-500"
                        onClick={() => void handleUnpin(pin.pin_id)}
                      >
                        Unpin
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="text-xl font-semibold text-gray-900 mb-4">Passages for this prompt</h2>
            {retrieveError && (
              <p className="text-sm text-red-700 mb-3" role="alert">{retrieveError}</p>
            )}
            <div className="bg-gray-50 rounded-lg p-4 min-h-48 space-y-4 max-h-96 overflow-y-auto">
              {isRetrieving && <p className="text-gray-500 text-center">Querying vectorized papers...</p>}
              {!isRetrieving && passages.length === 0 && stylePassages.length === 0 && !retrieveError && (
                <p className="text-gray-500 text-center">
                  Enter a research prompt and click Query sources. Generate uses the same retrieval.
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
                          .map((row) => {
                            const existing = pinForVector(pins, row.vector_id)
                            return (
                            <li
                              key={row.vector_id}
                              className="text-sm text-gray-700 bg-white border border-gray-200 rounded p-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs text-gray-500 mb-1">
                                  {row.pinned || isVectorPinned(pins, row.vector_id) ? 'pinned · ' : ''}
                                  {row.section ? `${row.section} · ` : ''}
                                  {row.page ? `p.${row.page} · ` : ''}
                                  {row.source_role} · score {row.score.toFixed(3)}
                                </div>
                                {existing ? (
                                  <button
                                    type="button"
                                    className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-500"
                                    onClick={() => void handleUnpin(existing.pin_id)}
                                  >
                                    Unpin
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-500"
                                    onClick={() => void handlePinPassage(row, row.paperSection)}
                                    disabled={!paperId}
                                  >
                                    Pin
                                  </button>
                                )}
                              </div>
                              {row.chunk_text.slice(0, 400)}
                              {row.chunk_text.length > 400 ? '…' : ''}
                            </li>
                            )
                          })}
                      </ul>
                    </div>
                  )
                )}
              {stylePassages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Style examples (not cited)</h3>
                  <ul className="space-y-2">
                    {stylePassages.map((row) => (
                      <li
                        key={row.vector_id}
                        className="text-sm text-gray-700 bg-white border border-dashed border-gray-300 rounded p-2"
                      >
                        {row.chunk_text.slice(0, 400)}
                        {row.chunk_text.length > 400 ? '…' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {draft && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Draft</h2>
                <p className="text-sm text-gray-600 mb-2">
                  Saved to the{' '}
                  <Link to="/library" className="text-primary-600 hover:text-primary-500">
                    library
                  </Link>
                  .
                </p>
                <DraftPreview
                  content={draft}
                  uncited={uncited}
                  citationCheck={citationCheck}
                  formatCheck={formatCheck}
                />
                {citedFiles.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Cited files</h3>
                    <ul className="text-sm text-gray-700 space-y-2">
                      {citedFiles.map((file) => (
                        <li key={file.file_id}>
                          <span className="font-medium">{file.file_name}</span>{' '}
                          <span className="text-xs text-gray-500">({file.source_role})</span>
                          {file.citation_text ? (
                            <p className="mt-1 text-gray-600">{file.citation_text}</p>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">
                              Add the publisher citation on Library.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
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
