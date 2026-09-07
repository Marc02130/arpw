import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { unzipSync, strFromU8 } from 'fflate'
import {
  EMBEDDING_MODEL,
  chunkText,
  hashEmbedding,
  storageTarget,
  textFromDocxXml,
  validateIngestFile,
  type IngestDocumentType,
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

const parsePdf = async (fileData: Uint8Array): Promise<string> => {
  const { extractText } = await import('unpdf')
  const result = await extractText(fileData)
  const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text ?? '')
  return text.trim()
}

const parseDocx = (fileData: Uint8Array): string => {
  const files = unzipSync(fileData)
  const xmlBytes = files['word/document.xml']
  if (!xmlBytes) {
    throw new Error('DOCX missing word/document.xml')
  }
  return textFromDocxXml(strFromU8(xmlBytes))
}

const parseFile = async (fileData: Uint8Array, fileName: string): Promise<string> => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'pdf':
      return await parsePdf(fileData)
    case 'docx':
      return parseDocx(fileData)
    case 'txt':
      return new TextDecoder().decode(fileData)
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
  documentType: IngestDocumentType
): Promise<number> => {
  const tableName = documentType === 'reference' ? 'reference_vectors' : 'example_vectors'
  await supabase.from(tableName).delete().eq('file_id', fileId)

  const rows = chunks.map((chunk) => ({
    file_id: fileId,
    vector: hashEmbedding(chunk.text),
    chunk_text: chunk.text,
    chunk_index: chunk.chunkIndex,
    section: chunk.section,
    embedding_model: EMBEDDING_MODEL,
  }))

  const batchSize = 100
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from(tableName).insert(rows.slice(i, i + batchSize))
    if (error) {
      throw new Error(`Failed to store vectors: ${error.message}`)
    }
  }
  return rows.length
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
    const text = await parseFile(bytes, request.fileName)
    if (!text) {
      throw new Error('File appears to be empty or could not be parsed')
    }

    const chunks = chunkText(text)
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
    const stored = await storeVectors(request.fileId, chunks, request.documentType)

    return json({
      success: true,
      message: 'File processed successfully',
      fileId: request.fileId,
      fileName: request.fileName,
      chunks: stored,
      embeddingModel: EMBEDDING_MODEL,
    })
  } catch (error) {
    console.error('Upload processor error:', error)
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      500
    )
  }
})
