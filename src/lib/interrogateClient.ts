import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInvokeError } from './generatePaperClient'
import type { InterrogatePassage } from './interrogateCorpus'
import type { InterrogateFilter } from './retrievePassages'

export type InterrogateInput = {
  paperId: string
  question: string
  filterRole?: InterrogateFilter
}

export type InterrogateResult = {
  answer: string
  passages: InterrogatePassage[]
  citedSids: string[]
  model: string
  paperId: string
  filterRole: InterrogateFilter
}

export const invokeInterrogateCorpus = async (
  client: SupabaseClient,
  input: InterrogateInput
): Promise<InterrogateResult> => {
  const { data, error } = await client.functions.invoke('interrogate_corpus', {
    body: {
      paperId: input.paperId,
      question: input.question,
      filterRole: input.filterRole,
    },
  })
  if (error || !data || data.success === false) {
    throw new Error(await generateInvokeError(data, error, 'Interrogation failed'))
  }
  if (typeof data.answer !== 'string') {
    throw new Error('Interrogation failed')
  }
  const filterRole: InterrogateFilter =
    data.filterRole === 'literature' || data.filterRole === 'primary' ? data.filterRole : 'both'
  return {
    answer: data.answer,
    passages: Array.isArray(data.passages) ? data.passages : [],
    citedSids: Array.isArray(data.citedSids) ? data.citedSids : [],
    model: typeof data.model === 'string' ? data.model : '',
    paperId: typeof data.paperId === 'string' ? data.paperId : input.paperId,
    filterRole,
  }
}
