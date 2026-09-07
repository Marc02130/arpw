import type { SupabaseClient } from '@supabase/supabase-js'
import { PAPER_SECTIONS, type PaperSection } from './generationTemplates'

export type PinInsert = {
  paperId: string
  fileId: string
  vectorId: string
  targetSection?: string | null
}

export type PinnedPassageRow = {
  pin_id: string
  paper_id: string
  file_id: string
  vector_id: string
  target_section: string | null
  created_at: string
}

export type PinnedPassage = PinnedPassageRow & {
  file_name: string
  source_role: string
  chunk_text: string
}

export const isPinTargetSection = (value: unknown): value is PaperSection =>
  typeof value === 'string' && (PAPER_SECTIONS as readonly string[]).includes(value)

export const parsePinTargetSection = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (isPinTargetSection(value)) return value
  throw new Error('Invalid pin target section')
}

export const isVectorPinned = (pins: Array<{ vector_id: string }>, vectorId: string): boolean =>
  pins.some((pin) => pin.vector_id === vectorId)

export const pinForVector = <T extends { vector_id: string }>(
  pins: T[],
  vectorId: string
): T | undefined => pins.find((pin) => pin.vector_id === vectorId)

export const attachPinDetails = (
  pins: PinnedPassageRow[],
  files: Array<{ file_id: string; file_name: string; source_role: string }>,
  chunks: Array<{ vector_id: string; chunk_text: string }>
): PinnedPassage[] => {
  const fileById = new Map(files.map((file) => [file.file_id, file]))
  const chunkById = new Map(chunks.map((chunk) => [chunk.vector_id, chunk]))
  return pins.map((pin) => {
    const file = fileById.get(pin.file_id)
    const chunk = chunkById.get(pin.vector_id)
    return {
      ...pin,
      file_name: file?.file_name ?? 'Unknown file',
      source_role: file?.source_role ?? 'literature',
      chunk_text: chunk?.chunk_text ?? '',
    }
  })
}

const mapPinError = (error: { code?: string; message: string }): Error => {
  if (error.code === '23505') return new Error('Already pinned')
  if (error.code === '23503') return new Error('Can only pin your own reference chunks')
  if (error.code === '23514') return new Error('Invalid pin target section')
  return new Error(error.message)
}

export const pinPassage = async (
  client: SupabaseClient,
  userId: string,
  input: PinInsert
): Promise<PinnedPassageRow> => {
  const target_section = parsePinTargetSection(input.targetSection ?? null)
  const { data, error } = await client
    .from('pinned_passages')
    .insert({
      user_id: userId,
      paper_id: input.paperId,
      file_id: input.fileId,
      vector_id: input.vectorId,
      target_section,
    })
    .select('pin_id, paper_id, file_id, vector_id, target_section, created_at')
    .single()
  if (error) throw mapPinError(error)
  return data as PinnedPassageRow
}

export const unpinPassage = async (client: SupabaseClient, pinId: string): Promise<void> => {
  const { error } = await client.from('pinned_passages').delete().eq('pin_id', pinId)
  if (error) throw new Error(error.message)
}

export const loadPins = async (
  client: SupabaseClient,
  paperId: string
): Promise<PinnedPassage[]> => {
  const { data, error } = await client
    .from('pinned_passages')
    .select('pin_id, paper_id, file_id, vector_id, target_section, created_at')
    .eq('paper_id', paperId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const pins = (data ?? []) as PinnedPassageRow[]
  if (pins.length === 0) return []

  const fileIds = [...new Set(pins.map((pin) => pin.file_id))]
  const vectorIds = [...new Set(pins.map((pin) => pin.vector_id))]
  const [files, chunks] = await Promise.all([
    client.from('references').select('file_id, file_name, source_role').in('file_id', fileIds),
    client.from('reference_vectors').select('vector_id, chunk_text').in('vector_id', vectorIds),
  ])
  if (files.error) throw new Error(files.error.message)
  if (chunks.error) throw new Error(chunks.error.message)
  return attachPinDetails(
    pins,
    (files.data ?? []) as Array<{ file_id: string; file_name: string; source_role: string }>,
    (chunks.data ?? []) as Array<{ vector_id: string; chunk_text: string }>
  )
}
