import type { SupabaseClient } from '@supabase/supabase-js'
import { CitationStyle, OutputFormat, PaperType, Status, type Paper } from '../types'
import { uniqueFileIds } from '../../supabase/functions/_shared/saveGeneratedDraft'

export {
  generatedDraftUpdateFields,
  parsePaperId,
  referenceCountFromEmbed,
  saveGeneratedDraft,
  uniqueFileIds,
} from '../../supabase/functions/_shared/saveGeneratedDraft'


export const DEFAULT_PAPER_SECTIONS: string[] = [
  'Abstract',
  'Introduction',
  'Methods',
  'Results',
  'Discussion',
  'Conclusion',
]

export const draftTitle = (raw: string): string => {
  const title = raw.trim()
  return title.length > 0 ? title : 'Untitled paper'
}

export type PaperConfigPatch = {
  title?: string
  sections?: string[]
  paper_type?: PaperType
  citation_style?: CitationStyle
  output_format?: OutputFormat
  research_prompt?: string
  outline?: string
}

export type CitedFile = {
  file_id: string
  file_name: string
  source_role: string
  citation_text?: string | null
}

export type CorpusCounts = {
  literature: number
  primary: number
  examples: number
}

export const loadCorpusCounts = async (
  client: SupabaseClient,
  userId: string
): Promise<CorpusCounts> => {
  const [literature, primary, examples] = await Promise.all([
    client.from('references').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('source_role', 'literature'),
    client.from('references').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('source_role', 'primary'),
    client.from('examples').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  const firstError = literature.error || primary.error || examples.error
  if (firstError) throw new Error(firstError.message)
  return {
    literature: literature.count ?? 0,
    primary: primary.count ?? 0,
    examples: examples.count ?? 0,
  }
}

export const loadCitedFiles = async (
  client: SupabaseClient,
  fileIds: string[]
): Promise<CitedFile[]> => {
  const ids = uniqueFileIds(fileIds)
  if (ids.length === 0) return []
  const { data, error } = await client
    .from('references')
    .select('file_id, file_name, source_role, citation_text')
    .in('file_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []) as CitedFile[]
}

export type SourceCitation = {
  file_id: string
  file_name: string
  source_role: string
  citation_text: string | null
}

export const loadSourceCitations = async (
  client: SupabaseClient,
  userId: string
): Promise<SourceCitation[]> => {
  const { data, error } = await client
    .from('references')
    .select('file_id, file_name, source_role, citation_text')
    .eq('user_id', userId)
    .order('file_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as SourceCitation[]
}

export const saveSourceCitation = async (
  client: SupabaseClient,
  fileId: string,
  citationText: string
): Promise<void> => {
  const { error } = await client
    .from('references')
    .update({ citation_text: citationText.trim() || null })
    .eq('file_id', fileId)
  if (error) throw new Error(error.message)
}

export const loadPaperCitedFiles = async (
  client: SupabaseClient,
  paperId: string
): Promise<CitedFile[]> => {
  const { data, error } = await client
    .from('paper_references')
    .select('file_id')
    .eq('paper_id', paperId)
  if (error) throw new Error(error.message)
  return loadCitedFiles(client, (data ?? []).map((row: { file_id: string }) => row.file_id))
}

export const createDraftPaper = async (
  client: SupabaseClient,
  userId: string,
  input: { title: string; paperType: PaperType }
): Promise<Paper> => {
  const { data, error } = await client
    .from('user_papers')
    .insert({
      user_id: userId,
      title: draftTitle(input.title),
      content: '',
      sections: DEFAULT_PAPER_SECTIONS,
      paper_type: input.paperType,
      citation_style: CitationStyle.APA,
      output_format: OutputFormat.MARKDOWN,
      version: 1,
      status: Status.DRAFT,
      research_prompt: '',
    })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create paper')
  }
  return data as Paper
}

export const listPapers = async (client: SupabaseClient, userId: string): Promise<Paper[]> => {
  const { data, error } = await client
    .from('user_papers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as Paper[]
}

export const loadPaper = async (client: SupabaseClient, paperId: string): Promise<Paper> => {
  const { data, error } = await client
    .from('user_papers')
    .select('*')
    .eq('paper_id', paperId)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'Paper not found')
  }
  return data as Paper
}

export const deletePaper = async (client: SupabaseClient, paperId: string): Promise<void> => {
  const { data, error } = await client
    .from('user_papers')
    .delete()
    .eq('paper_id', paperId)
    .select('paper_id')
  if (error) {
    throw new Error(error.message)
  }
  if (!data || data.length === 0) {
    throw new Error('Paper not found')
  }
}

export const updatePaperConfig = async (
  client: SupabaseClient,
  paperId: string,
  patch: PaperConfigPatch
): Promise<void> => {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = draftTitle(patch.title)
  if (patch.sections !== undefined) body.sections = patch.sections
  if (patch.paper_type !== undefined) body.paper_type = patch.paper_type
  if (patch.citation_style !== undefined) body.citation_style = patch.citation_style
  if (patch.output_format !== undefined) body.output_format = patch.output_format
  if (patch.research_prompt !== undefined) body.research_prompt = patch.research_prompt
  if (patch.outline !== undefined) body.outline = patch.outline
  if (Object.keys(body).length === 0) return
  const { error } = await client.from('user_papers').update(body).eq('paper_id', paperId)
  if (error) {
    throw new Error(error.message)
  }
}

export const paperSectionsOrDefault = (sections: string[] | null | undefined): string[] => {
  if (sections && sections.length > 0) return sections
  return [...DEFAULT_PAPER_SECTIONS]
}

export const paperConfigIsHydrated = (
  paper: { paper_id: string } | null,
  paperId: string | null
): boolean => Boolean(paperId && paper && paper.paper_id === paperId)

/** Why Query sources / Generate stay disabled. Null means the control may run. */
export const querySourcesDisabledReason = (opts: {
  hydrated: boolean
  prompt: string
  retrieving?: boolean
}): string | null => {
  if (opts.retrieving) return null
  if (!opts.hydrated) return 'Loading saved paper…'
  if (!opts.prompt.trim()) return 'Enter a research prompt to query sources.'
  return null
}

export const nextVersionForTitle = (versions: number[]): number => {
  const max = versions.reduce((acc, version) => (version > acc ? version : acc), 0)
  return max + 1
}

export const createRegenerateDraft = async (
  client: SupabaseClient,
  userId: string,
  source: Paper
): Promise<Paper> => {
  const { data: siblings, error: listError } = await client
    .from('user_papers')
    .select('version')
    .eq('user_id', userId)
    .eq('title', source.title)
  if (listError) throw new Error(listError.message)
  const version = nextVersionForTitle((siblings ?? []).map((row: { version: number }) => row.version))
  const { data, error } = await client
    .from('user_papers')
    .insert({
      user_id: userId,
      title: source.title,
      content: '',
      sections: paperSectionsOrDefault(source.sections),
      paper_type: source.paper_type,
      citation_style: source.citation_style,
      output_format: source.output_format,
      version,
      status: Status.DRAFT,
      research_prompt: source.research_prompt ?? '',
      outline: source.outline ?? '',
    })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create regenerated draft')
  }
  return data as Paper
}
