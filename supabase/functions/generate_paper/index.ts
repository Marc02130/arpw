import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { generatePaperDraft, parseGenerateRequest } from '../_shared/generatePaper.ts'
import {
  GROK_MODEL,
  MISSING_GROK_KEY_MESSAGE,
  completeWithGrok,
} from '../_shared/grokComplete.ts'
import { grokQueryEmbed } from '../_shared/embedText.ts'
import {
  DEFAULT_EXAMPLE_MATCH_COUNT,
  loadEvidencePins,
  retrieveExamplePassages,
  retrieveForSection,
} from '../_shared/retrievePassages.ts'
import {
  hasUsableBibliographicRecord,
  type BibliographicRecord,
} from '../_shared/bibliographicCitation.ts'
import {
  isCatalogRecord,
  lookupBibliographicRecord,
  lookupCitationText,
} from '../_shared/bibliographicLookup.ts'
import { saveGeneratedDraft, uniqueFileIds } from '../_shared/saveGeneratedDraft.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SB_ANON_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: cors })
    }
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return json({ success: false, error: 'Server misconfigured' }, 500)
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return json({ success: false, error: 'Authorization header required' }, 401)
    }

    const service = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const {
      data: { user },
      error: authError,
    } = await service.auth.getUser(token)
    if (authError || !user) {
      return json({ success: false, error: 'Invalid authentication' }, 401)
    }

    let parsed: ReturnType<typeof parseGenerateRequest>
    try {
      parsed = parseGenerateRequest(await req.json())
    } catch (parseError) {
      return json(
        { success: false, error: parseError instanceof Error ? parseError.message : 'Invalid generate request' },
        400
      )
    }

    const { data: apiKey, error: keyError } = await service.rpc('read_grok_api_key', {
      for_user: user.id,
    })
    if (keyError) {
      throw new Error(keyError.message)
    }
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      return json(
        { success: false, error: MISSING_GROK_KEY_MESSAGE, code: 'missing_grok_key' },
        400
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: paper, error: paperError } = await userClient
      .from('user_papers')
      .select('paper_id')
      .eq('paper_id', parsed.paperId)
      .maybeSingle()
    if (paperError) {
      throw new Error(paperError.message)
    }
    if (!paper) {
      return json({ success: false, error: 'Paper not found' }, 404)
    }

    const pins = await loadEvidencePins(userClient, parsed.paperId)
    const embed = grokQueryEmbed(apiKey)
    const result = await generatePaperDraft({
      paperType: parsed.paperType,
      sections: parsed.sections,
      researchPrompt: parsed.researchPrompt,
      retrieve: (paperType, section, researchPrompt) =>
        retrieveForSection(userClient, paperType, section, researchPrompt, { pins, embed }),
      retrieveExamples: (paperType, section, researchPrompt) =>
        retrieveExamplePassages(
          userClient,
          paperType,
          section,
          researchPrompt,
          DEFAULT_EXAMPLE_MATCH_COUNT,
          embed
        ),
      complete: (prompt) => completeWithGrok(apiKey, prompt),
      citationStyle: parsed.citationStyle ?? 'APA',
      lookupCitedFiles: async (fileIds) => {
        const ids = uniqueFileIds(fileIds)
        if (ids.length === 0) return []
        const { data, error } = await userClient
          .from('references')
          .select('file_id, file_name, bibliographic, citation_text')
          .in('file_id', ids)
        if (error) throw new Error(error.message)
        const rows = (data ?? []) as Array<{
          file_id: string
          file_name: string
          bibliographic: BibliographicRecord | null
          citation_text: string | null
        }>
        const works = []
        for (const row of rows) {
          let bibliographic = row.bibliographic
          let citation_text = row.citation_text?.trim() || null
          if (!citation_text || !isCatalogRecord(bibliographic)) {
            const { data: chunks, error: chunkError } = await userClient
              .from('reference_vectors')
              .select('chunk_text')
              .eq('file_id', row.file_id)
              .order('chunk_index', { ascending: true })
              .limit(4)
            if (chunkError) throw new Error(chunkError.message)
            const front = (chunks ?? [])
              .map((chunk: { chunk_text: string }) => chunk.chunk_text)
              .join('\n')
            if (!isCatalogRecord(bibliographic)) {
              bibliographic = await lookupBibliographicRecord(front, fetch)
            }
            if (!citation_text) {
              citation_text = await lookupCitationText(front, parsed.citationStyle ?? 'APA', fetch)
            }
            const patch: Record<string, unknown> = {}
            if (hasUsableBibliographicRecord(bibliographic)) patch.bibliographic = bibliographic
            if (citation_text) patch.citation_text = citation_text
            if (Object.keys(patch).length > 0) {
              await userClient.from('references').update(patch).eq('file_id', row.file_id)
            }
          }
          works.push({
            file_id: row.file_id,
            file_name: row.file_name,
            bibliographic,
            citation_text,
          })
        }
        return works
      },
    })

    const saved = await saveGeneratedDraft(userClient, {
      paperId: parsed.paperId,
      content: result.content,
      sections: parsed.sections,
      paperType: parsed.paperType,
      citationStyle: parsed.citationStyle,
      outputFormat: parsed.outputFormat,
      citedFileIds: result.citedFileIds,
      attribution: result.attribution,
    })

    return json({
      success: true,
      content: result.content,
      sections: result.sections,
      citedFileIds: saved.citedFileIds,
      attribution: result.attribution,
      model: GROK_MODEL,
      paperId: saved.paperId,
      status: saved.status,
      saved: true,
    })
  } catch (error) {
    console.error('generate_paper error:', error)
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      500
    )
  }
})
