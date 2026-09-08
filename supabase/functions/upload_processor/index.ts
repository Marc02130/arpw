import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { unzipSync, strFromU8 } from 'fflate'
import { embedTexts } from '../_shared/embedText.ts'
import { hasUsableBibliographicRecord } from '../_shared/bibliographicCitation.ts'
import { lookupBibliographicRecord, lookupCitationText } from '../_shared/bibliographicLookup.ts'
import {
  chunkLines,
  linesFromDocxXml,
  linesFromText,
  pagesFromExtractText,
  storageTarget,
  validateIngestFile,
  type IngestDocumentType,
  type SourceLine,
  type TextChunk,
} from './ingest.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface UploadRequest {
  fileId: string
  fileName: string
  fileSize: number
  documentType: IngestDocumentType
}

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

const downloadObject = async (bucket: string, key: string): Promise<Uint8Array> => {
  const { data, error } = await supabase.storage.from(bucket).download(key)
  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message ?? 'missing object'}`)
  }
  return new Uint8Array(await data.arrayBuffer())
}

const parsePdfLines = async (fileData: Uint8Array): Promise<SourceLine[]> => {
  const { extractText } = await import('unpdf')
  const result = await extractText(fileData, { mergePages: false })
  const pages = pagesFromExtractText(result.text)
  return pages.flatMap((pageText, index) => linesFromText(pageText, index + 1))
}

const parseDocxLines = (fileData: Uint8Array): SourceLine[] => {
  const files = unzipSync(fileData)
  const xmlBytes = files['word/document.xml']
  if (!xmlBytes) {
    throw new Error('DOCX missing word/document.xml')
  }
  return linesFromDocxXml(strFromU8(xmlBytes))
}

const parseFileLines = async (fileData: Uint8Array, fileName: string): Promise<SourceLine[]> => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'pdf':
      return await parsePdfLines(fileData)
    case 'docx':
      return parseDocxLines(fileData)
    case 'txt':
      return linesFromText(new TextDecoder().decode(fileData))
    default:
      throw new Error(`Unsupported file type: ${extension}`)
  }
}

const storeDocumentMetadata = async (
  fileId: string,
  userId: string,
  documentType: IngestDocumentType,
  fileName: string,
  fileSize: number
): Promise<void> => {
  const tableName = documentType === 'reference' ? 'references' : 'examples'
  const { error } = await supabase.from(tableName).insert({
    file_id: fileId,
    user_id: userId,
    document_type: documentType,
    file_name: fileName,
    file_size: fileSize,
  })
  if (error && error.code !== '23505') {
    throw new Error(`Failed to store document metadata: ${error.message}`)
  }
}

const storeVectors = async (
  fileId: string,
  chunks: TextChunk[],
  documentType: IngestDocumentType,
  apiKey: string | null
): Promise<{ stored: number; embeddingModel: string }> => {
  const tableName = documentType === 'reference' ? 'reference_vectors' : 'example_vectors'
  await supabase.from(tableName).delete().eq('file_id', fileId)

  const embedded = await embedTexts(
    chunks.map((chunk) => chunk.text),
    { apiKey, purpose: 'passage', allowHashFallback: true }
  )

  const rows = chunks.map((chunk, index) => ({
    file_id: fileId,
    vector: embedded.vectors[index],
    chunk_text: chunk.text,
    chunk_index: chunk.chunkIndex,
    section: chunk.section,
    page: chunk.page,
    embedding_model: embedded.model,
  }))

  const batchSize = 100
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from(tableName).insert(rows.slice(i, i + batchSize))
    if (error) {
      throw new Error(`Failed to store vectors: ${error.message}`)
    }
  }
  return { stored: rows.length, embeddingModel: embedded.model }
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: cors })
    }
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return json({ success: false, error: 'Authorization header required' }, 401)
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return json({ success: false, error: 'Invalid authentication' }, 401)
    }

    const request = (await req.json()) as UploadRequest
    if (!request.fileId || !request.fileName || !request.documentType) {
      return json({ success: false, error: 'Missing required fields' }, 400)
    }
    if (request.documentType !== 'reference' && request.documentType !== 'example') {
      return json({ success: false, error: 'Invalid documentType' }, 400)
    }

    const validationError = validateIngestFile(request.fileName, request.fileSize)
    if (validationError) {
      return json({ success: false, error: validationError }, 400)
    }

    let bucket: string
    let key: string
    try {
      const target = storageTarget(request.documentType, user.id, request.fileId)
      bucket = target.bucket
      key = target.key
    } catch (pathError) {
      return json(
        { success: false, error: pathError instanceof Error ? pathError.message : 'Invalid storage path' },
        400
      )
    }
    const bytes = await downloadObject(bucket, key)
    const lines = await parseFileLines(bytes, request.fileName)
    const parsedText = lines.map((line) => line.text).join('\n').trim()
    if (!parsedText) {
      throw new Error('File appears to be empty or could not be parsed')
    }

    const chunks = chunkLines(lines)
    if (chunks.length === 0) {
      throw new Error('No valid text chunks could be extracted from the file')
    }

    await storeDocumentMetadata(
      request.fileId,
      user.id,
      request.documentType,
      request.fileName,
      request.fileSize
    )
    const { data: apiKey, error: keyError } = await supabase.rpc('read_grok_api_key', {
      for_user: user.id,
    })
    if (keyError) {
      throw new Error(keyError.message)
    }
    const stored = await storeVectors(
      request.fileId,
      chunks,
      request.documentType,
      typeof apiKey === 'string' ? apiKey : null
    )

    if (request.documentType === 'reference') {
      const front = lines
        .filter((line) => line.page === 1 || line.page == null)
        .slice(0, 50)
        .map((line) => line.text)
        .join('\n')
      try {
        const blob = front || parsedText.slice(0, 4000)
        const bibliographic = await lookupBibliographicRecord(blob, fetch)
        const citation_text = await lookupCitationText(blob, 'APA', fetch)
        const patch: Record<string, unknown> = {}
        if (hasUsableBibliographicRecord(bibliographic)) patch.bibliographic = bibliographic
        if (citation_text) patch.citation_text = citation_text
        if (Object.keys(patch).length > 0) {
          await supabase.from('references').update(patch).eq('file_id', request.fileId)
        }
      } catch {
        /* catalog lookup is best-effort; ingest still succeeds */
      }
    }

    return json({
      success: true,
      message: 'File processed successfully',
      fileId: request.fileId,
      fileName: request.fileName,
      chunks: stored.stored,
      embeddingModel: stored.embeddingModel,
    })
  } catch (error) {
    console.error('Upload processor error:', error)
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      500
    )
  }
})
