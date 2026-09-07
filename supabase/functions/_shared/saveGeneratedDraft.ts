import type { SupabaseClient } from '@supabase/supabase-js'

export const PAPER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const parsePaperId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return PAPER_ID_PATTERN.test(id) ? id : null
}

export const uniqueFileIds = (fileIds: string[]): string[] => [...new Set(fileIds.filter(Boolean))]

export const referenceCountFromEmbed = (
  embed: Array<{ count?: number }> | { count?: number } | null | undefined
): number => {
  if (Array.isArray(embed)) {
    const count = embed[0]?.count
    return typeof count === 'number' ? count : 0
  }
  return typeof embed?.count === 'number' ? embed.count : 0
}

export type SaveGeneratedDraftInput = {
  paperId: string
  content: string
  sections: string[]
  paperType: string
  citationStyle?: string
  outputFormat?: string
  citedFileIds: string[]
}

export const saveGeneratedDraft = async (
  client: SupabaseClient,
  input: SaveGeneratedDraftInput
): Promise<{ paperId: string; citedFileIds: string[]; status: 'completed' }> => {
  const paperId = parsePaperId(input.paperId)
  if (!paperId) {
    throw new Error('Paper id required')
  }
  const content = input.content.trim()
  if (!content) {
    throw new Error('Generated content was empty')
  }

  const patch: Record<string, unknown> = {
    content: input.content,
    sections: input.sections,
    paper_type: input.paperType,
    status: 'completed',
  }
  if (input.citationStyle) patch.citation_style = input.citationStyle
  if (input.outputFormat) patch.output_format = input.outputFormat

  const { data: updated, error: updateError } = await client
    .from('user_papers')
    .update(patch)
    .eq('paper_id', paperId)
    .select('paper_id')
    .maybeSingle()
  if (updateError) {
    throw new Error(updateError.message)
  }
  if (!updated) {
    throw new Error('Paper not found')
  }

  const { error: deleteError } = await client.from('paper_references').delete().eq('paper_id', paperId)
  if (deleteError) {
    throw new Error(deleteError.message)
  }

  const wanted = uniqueFileIds(input.citedFileIds)
  let owned: string[] = []
  if (wanted.length > 0) {
    const { data: rows, error: ownedError } = await client
      .from('references')
      .select('file_id')
      .in('file_id', wanted)
    if (ownedError) {
      throw new Error(ownedError.message)
    }
    owned = uniqueFileIds((rows ?? []).map((row: { file_id: string }) => row.file_id))
  }

  if (owned.length > 0) {
    const { error: insertError } = await client
      .from('paper_references')
      .insert(owned.map((file_id) => ({ paper_id: paperId, file_id })))
    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  return { paperId, citedFileIds: owned, status: 'completed' }
}
