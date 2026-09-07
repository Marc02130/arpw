import type { SupabaseClient } from '@supabase/supabase-js'
import type { GeneratedSection } from './generatePaper'

export type GeneratePaperInput = {
  paperType: string
  sections: string[]
  researchPrompt: string
}

export type GeneratePaperResult = {
  content: string
  sections: GeneratedSection[]
  citedFileIds: string[]
  model: string
}

const messageFromBody = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null
  const error = (body as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error : null
}

export const generateInvokeError = async (
  data: unknown,
  error: { message?: string; context?: unknown } | null
): Promise<string> => {
  const fromData = messageFromBody(data)
  if (fromData) return fromData

  const context = error?.context
  const fromContextObject = messageFromBody(context)
  if (fromContextObject) return fromContextObject
  if (context && typeof context === 'object' && 'json' in context && typeof context.json === 'function') {
    try {
      const body = await context.json()
      const fromContext = messageFromBody(body)
      if (fromContext) return fromContext
    } catch {
      /* Response body was not JSON */
    }
  }

  return error?.message?.trim() || 'Paper generation failed'
}

export const invokeGeneratePaper = async (
  client: SupabaseClient,
  input: GeneratePaperInput
): Promise<GeneratePaperResult> => {
  const { data, error } = await client.functions.invoke('generate_paper', {
    body: {
      paperType: input.paperType,
      sections: input.sections,
      researchPrompt: input.researchPrompt,
    },
  })
  if (error || !data || data.success === false) {
    throw new Error(await generateInvokeError(data, error))
  }
  if (typeof data.content !== 'string') {
    throw new Error('Paper generation failed')
  }
  return {
    content: data.content,
    sections: Array.isArray(data.sections) ? data.sections : [],
    citedFileIds: Array.isArray(data.citedFileIds) ? data.citedFileIds : [],
    model: typeof data.model === 'string' ? data.model : '',
  }
}
