import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { embedTexts, type EmbedPurpose } from '../_shared/embedText.ts'

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

const parsePurpose = (value: unknown): EmbedPurpose => (value === 'passage' ? 'passage' : 'query')

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

    const body = (await req.json()) as { text?: unknown; purpose?: unknown }
    if (typeof body.text !== 'string' || !body.text.trim()) {
      return json({ success: false, error: 'Enter a research prompt' }, 400)
    }

    const { data: apiKey, error: keyError } = await service.rpc('read_grok_api_key', {
      for_user: user.id,
    })
    if (keyError) {
      throw new Error(keyError.message)
    }

    const purpose = parsePurpose(body.purpose)
    const result = await embedTexts([body.text.trim()], {
      apiKey: typeof apiKey === 'string' ? apiKey : null,
      purpose,
      allowHashFallback: true,
    })

    return json({
      success: true,
      embedding: result.vectors[0],
      model: result.model,
    })
  } catch (error) {
    console.error('embed_text error:', error)
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      500
    )
  }
})
