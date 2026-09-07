import React, { useState } from 'react'
import { PaperGenerationConfig, PaperType, CitationStyle, OutputFormat, DocumentType } from '../types'
import UploadZone from '../components/UploadZone'
import DocumentList from '../components/DocumentList'

const DashboardPage: React.FC = () => {
  const [config, setConfig] = useState<PaperGenerationConfig>({
    prompt: '',
    sections: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion'],
    paper_type: PaperType.EMPIRICAL_STUDY,
    citation_style: CitationStyle.APA,
    output_format: OutputFormat.MARKDOWN,
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const availableSections = [
    'Abstract',
    'Introduction', 
    'Literature Review',
    'Methods',
    'Results',
    'Discussion',
    'Conclusion',
    'References'
  ]

  const handleSectionToggle = (section: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.includes(section)
        ? prev.sections.filter(s => s !== section)
        : [...prev.sections, section]
    }))
  }

  const handleUploadComplete = () => {
    setUploadSuccess('Files uploaded. Indexing may still fail until ingest is fixed.')
    setUploadError(null)
    // Clear success message after 5 seconds
    setTimeout(() => setUploadSuccess(null), 5000)
  }

  const handleUploadError = (error: string) => {
    setUploadError(error)
    setUploadSuccess(null)
    // Clear error message after 10 seconds
    setTimeout(() => setUploadError(null), 10000)
  }

  const handleDocumentDeleted = () => {
    // Documents will be refreshed automatically by the DocumentList component
  }

  const handleGenerate = async () => {
    if (!config.prompt.trim()) {
      alert('Please enter a research prompt')
      return
    }

    setIsGenerating(true)
    try {
      // TODO: Implement paper generation logic
      console.log('Generating paper with config:', config)
      // Simulate generation time
      await new Promise(resolve => setTimeout(resolve, 2000))
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Generate Research Paper</h1>
        <p className="mt-2 text-gray-600">
          Create AI-powered research paper drafts using your uploaded references and examples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Research Prompt</h2>
            <textarea
              value={config.prompt}
              onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
              className="input-field h-32 resize-none"
              placeholder="Describe your research topic, objectives, and any specific requirements..."
            />
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Paper Sections</h2>
            <div className="grid grid-cols-2 gap-2">
              {availableSections.map((section) => (
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paper Type
                </label>
                <select
                  value={config.paper_type}
                  onChange={(e) => setConfig(prev => ({ ...prev, paper_type: e.target.value as PaperType }))}
                  className="input-field"
                >
                  {Object.values(PaperType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Citation Style
                </label>
                <select
                  value={config.citation_style}
                  onChange={(e) => setConfig(prev => ({ ...prev, citation_style: e.target.value as CitationStyle }))}
                  className="input-field"
                >
                  {Object.values(CitationStyle).map((style) => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Output Format
                </label>
                <select
                  value={config.output_format}
                  onChange={(e) => setConfig(prev => ({ ...prev, output_format: e.target.value as OutputFormat }))}
                  className="input-field"
                >
                  {Object.values(OutputFormat).map((format) => (
                    <option key={format} value={format}>{format.charAt(0).toUpperCase() + format.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !config.prompt.trim()}
            className="btn-primary w-full py-3 text-lg"
          >
            {isGenerating ? 'Generating...' : 'Generate Paper'}
          </button>
        </div>

        {/* Document Management Panel */}
        <div className="space-y-6">
          {/* Upload Messages */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{uploadError}</p>
                </div>
              </div>
            </div>
          )}

          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{uploadSuccess}</p>
                </div>
              </div>
            </div>
          )}

          {/* Reference Documents */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reference Documents</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload up to 500 reference documents (PDF, DOCX, TXT) for citations and research context. The cap counts files you already stored, not only this batch.
            </p>
            
            <UploadZone
              documentType={DocumentType.REFERENCE}
              maxFiles={500}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
            
            <div className="mt-6">
              <DocumentList
                documentType={DocumentType.REFERENCE}
                onDocumentDeleted={handleDocumentDeleted}
              />
            </div>
          </div>

          {/* Example Papers */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Example Papers</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload up to 10 example papers for style emulation and formatting reference.
            </p>
            
            <UploadZone
              documentType={DocumentType.EXAMPLE}
              maxFiles={10}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
            
            <div className="mt-6">
              <DocumentList
                documentType={DocumentType.EXAMPLE}
                onDocumentDeleted={handleDocumentDeleted}
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Generation Preview</h2>
            <div className="bg-gray-50 rounded-lg p-4 min-h-48">
              <p className="text-gray-500 text-center">
                {isGenerating 
                  ? 'Generating your research paper...' 
                  : 'Your generated paper will appear here'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
