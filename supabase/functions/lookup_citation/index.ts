import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { extractDoi, extractPmid } from '../_shared/bibliographicCitation.ts'
import {
  fetchFormattedCitation,
  lookupBibliographicRecord,
  lookupCitationText,
} from '../_shared/bibliographicLookup.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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
    if (!supabaseUrl || !supabaseServiceKey) {
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

    const body = await req.json().catch(() => ({})) as {
      doi?: unknown
      pmid?: unknown
      text?: unknown
      style?: unknown
    }
    const style = typeof body.style === 'string' ? body.style : 'APA'
    const blob = [body.doi, body.pmid, body.text].filter((value) => typeof value === 'string').join('\n')
    const doi = typeof body.doi === 'string' && body.doi.trim() ? extractDoi(body.doi) ?? body.doi.trim() : extractDoi(blob)
    const pmid = typeof body.pmid === 'string' && body.pmid.trim() ? body.pmid.trim() : extractPmid(blob)

    let citation_text: string | null = null
    if (doi) {
      citation_text = await fetchFormattedCitation(doi, style, fetch)
    }
    if (!citation_text) {
      citation_text = await lookupCitationText(`${doi ?? ''}\nPMID: ${pmid ?? ''}`, style, fetch)
    }
    const bibliographic = await lookupBibliographicRecord(
      `${doi ? `https://doi.org/${doi}` : ''}\n${pmid ? `PMID: ${pmid}` : ''}\n${blob}`,
      fetch
    )

    return json({
      success: true,
      citation_text,
      bibliographic: bibliographic.source ? bibliographic : null,
      doi: doi ?? bibliographic.doi,
      pmid,
    })
  } catch (error) {
    console.error('lookup_citation error:', error)
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      500
    )
  }
})
