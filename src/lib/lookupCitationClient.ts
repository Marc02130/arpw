import type { SupabaseClient } from '@supabase/supabase-js'

export const invokeLookupCitation = async (
  client: SupabaseClient,
  input: { doi?: string; pmid?: string; text?: string; style?: string }
): Promise<string> => {
  const { data, error } = await client.functions.invoke('lookup_citation', { body: input })
  if (error) throw new Error(error.message)
  const rec = data as { success?: boolean; citation_text?: string | null; error?: string }
  if (!rec?.success) throw new Error(rec?.error ?? 'Citation lookup failed')
  const text = rec.citation_text?.trim()
  if (!text) throw new Error('No preformatted citation found for that DOI or PMID')
  return text
}
