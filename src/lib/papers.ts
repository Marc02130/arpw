import type { SupabaseClient } from '@supabase/supabase-js'
import { CitationStyle, OutputFormat, PaperType, Status, type Paper } from '../types'

export {
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
