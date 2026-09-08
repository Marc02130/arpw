import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { invokeLookupCitation } from '../lib/lookupCitationClient'
import { saveSourceCitation } from '../lib/papers'

type CitationFieldProps = {
  fileId: string
  fileName: string
  citationText: string | null
  citationStyle?: string
  onSaved?: (citationText: string) => void
}

const CitationField: React.FC<CitationFieldProps> = ({
  fileId,
  fileName,
  citationText,
  citationStyle = 'APA',
  onSaved,
}) => {
  const fieldId = `citation-${fileId}`
  const [value, setValue] = useState(citationText ?? '')
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setValue(citationText ?? '')
  }, [citationText])

  const save = async (next: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSourceCitation(supabase, fileId, next)
      onSaved?.(next.trim())
      setMessage('Citation saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save citation')
    } finally {
      setSaving(false)
    }
  }

  const lookup = async () => {
    setLookingUp(true)
    setMessage(null)
    try {
      const text = await invokeLookupCitation(supabase, { text: value, style: citationStyle })
      setValue(text)
      await saveSourceCitation(supabase, fileId, text)
      onSaved?.(text)
      setMessage('Citation fetched and saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lookup failed')
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-xs font-medium text-gray-600">
        Citation
        <span className="font-normal text-gray-500"> — paste the publisher/PubMed cite, or look up from a DOI</span>
      </label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if ((value.trim() || '') !== (citationText ?? '').trim()) void save(value)
        }}
        rows={3}
        className="input-field text-sm"
        placeholder={`Paste the preformatted citation for ${fileName}`}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void lookup()}
          disabled={lookingUp || saving}
          className="text-xs font-medium text-primary-600 hover:text-primary-500 disabled:opacity-50"
        >
          {lookingUp ? 'Looking up…' : 'Look up from DOI/PMID'}
        </button>
        {saving && <span className="text-xs text-gray-500">Saving…</span>}
        {message && (
          <span className="text-xs text-gray-600" role="status">
            {message}
          </span>
        )}
      </div>
    </div>
  )
}

export default CitationField
