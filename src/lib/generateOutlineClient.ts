import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInvokeError } from './generatePaperClient'

export type GenerateOutlineInput = {
  paperId: string
  paperType: string
  sections: string[]
  researchPrompt: string
}

export type GenerateOutlineResult = {
  outline: string
  model: string
  paperId: string
}

export const invokeGenerateOutline = async (
  client: SupabaseClient,
  input: GenerateOutlineInput
): Promise<GenerateOutlineResult> => {
  const { data, error } = await client.functions.invoke('generate_outline', {
    body: {
      paperId: input.paperId,
      paperType: input.paperType,
      sections: input.sections,
      researchPrompt: input.researchPrompt,
    },
  })
  if (error || !data || data.success === false) {
    throw new Error(await generateInvokeError(data, error, 'Outline generation failed'))
  }
  if (typeof data.outline !== 'string') {
    throw new Error('Outline generation failed')
  }
  return {
    outline: data.outline,
    model: typeof data.model === 'string' ? data.model : '',
    paperId: typeof data.paperId === 'string' ? data.paperId : input.paperId,
  }
}
