import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { generateOutlineDraft, parseOutlineRequest } from '../_shared/generateOutline.ts'
import {
  GROK_MODEL,
  MISSING_GROK_KEY_MESSAGE,
  completeWithGrok,
} from '../_shared/grokComplete.ts'
import { grokQueryEmbed } from '../_shared/embedText.ts'
import { loadEvidencePins, retrieveForSection } from '../_shared/retrievePassages.ts'

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

    let parsed: ReturnType<typeof parseOutlineRequest>
    try {
      parsed = parseOutlineRequest(await req.json())
    } catch (parseError) {
      return json(
        {
          success: false,
          error: parseError instanceof Error ? parseError.message : 'Invalid outline request',
        },
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
    const result = await generateOutlineDraft({
      paperType: parsed.paperType,
      sections: parsed.sections,
      researchPrompt: parsed.researchPrompt,
      retrieve: (paperType, section, researchPrompt) =>
        retrieveForSection(userClient, paperType, section, researchPrompt, { pins, embed }),
      complete: (prompt) => completeWithGrok(apiKey, prompt),
    })

    const { error: saveError } = await userClient
      .from('user_papers')
      .update({ outline: result.outline })
      .eq('paper_id', parsed.paperId)
    if (saveError) {
      throw new Error(saveError.message)
    }

    return json({
      success: true,
      outline: result.outline,
      model: GROK_MODEL,
      paperId: parsed.paperId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outline generation failed'
    return json({ success: false, error: message }, 500)
  }
})
