import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HASH_EMBEDDING_MODEL,
  type QueryEmbedFn,
  type QueryEmbedResult,
} from './embedText'
import { generateInvokeError } from './generatePaperClient'
import { hashEmbedding } from '../../supabase/functions/upload_processor/ingest'

export const invokeEmbedText = async (
  client: SupabaseClient,
  text: string,
  purpose: 'query' | 'passage'
): Promise<QueryEmbedResult> => {
  const { data, error } = await client.functions.invoke('embed_text', {
    body: { text, purpose },
  })
  if (error || !data || data.success === false) {
    throw new Error(await generateInvokeError(data, error, 'Could not embed text'))
  }
  if (!Array.isArray(data.embedding) || typeof data.model !== 'string') {
    throw new Error('Could not embed text')
  }
  return {
    vector: data.embedding.map((value: unknown) => Number(value)),
    model: data.model,
  }
}

export const clientQueryEmbed = (client: SupabaseClient): QueryEmbedFn => async (text) => {
  try {
    return await invokeEmbedText(client, text, 'query')
  } catch {
    return { vector: hashEmbedding(text), model: HASH_EMBEDDING_MODEL }
  }
}
