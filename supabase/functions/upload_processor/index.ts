import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers.js'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter.js'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize embeddings model
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: 'sentence-transformers/all-MiniLM-L6-v2',
  maxConcurrency: 5,
})

// Text splitter configuration
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', ' ', ''],
})

interface UploadRequest {
  fileId: string
  fileName: string
  fileSize: number
  documentType: 'reference' | 'example'
  storagePath: string
  userId: string
}

interface ProcessedChunk {
  text: string
  vector: number[]
}

const validateFile = (fileName: string, fileSize: number): string | null => {
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024
  if (fileSize > maxSize) {
    return `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`
  }

  // Check file extension
  const extension = fileName.split('.').pop()?.toLowerCase()
  const allowedExtensions = ['pdf', 'docx', 'txt']
  
  if (!extension || !allowedExtensions.includes(extension)) {
    return `Unsupported file type: ${extension}. Allowed: ${allowedExtensions.join(', ')}`
  }

  return null
}

const downloadFile = async (storagePath: string): Promise<Uint8Array> => {
  const { data, error } = await supabase.storage
    .from(storagePath.split('/')[0])
    .download(storagePath.split('/').slice(1).join('/'))

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`)
  }

  return new Uint8Array(await data.arrayBuffer())
}

const parseFile = async (fileData: Uint8Array, fileName: string): Promise<string> => {
  const extension = fileName.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'pdf':
      return await parsePDF(fileData)
    case 'docx':
      return await parseDOCX(fileData)
    case 'doc':
      return await parseDOC(fileData)
    case 'txt':
      return new TextDecoder().decode(fileData)
    default:
      throw new Error(`Unsupported file type: ${extension}`)
  }
}

const parsePDF = async (fileData: Uint8Array): Promise<string> => {
  try {
    // Import pdf-parse dynamically
    const pdfParse = await import('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse.default(Buffer.from(fileData))
    return data.text
  } catch (error) {
    throw new Error(`PDF parsing failed: ${(error as Error).message}`)
  }
}

const parseDOCX = async (fileData: Uint8Array): Promise<string> => {
  try {
    // Import docx dynamically
    const { Document } = await import('docx')
    const doc = Document.load(Buffer.from(fileData))
    return doc.getText()
  } catch (error) {
    throw new Error(`DOCX parsing failed: ${(error as Error).message}`)
  }
}

const parseDOC = async (fileData: Uint8Array): Promise<string> => {
  // For .doc files, we'll need a more complex parser
  // For now, we'll throw an error and suggest converting to .docx
  throw new Error('DOC files are not supported. Please convert to DOCX format.')
}

const chunkText = async (text: string): Promise<string[]> => {
  try {
    const chunks = await textSplitter.splitText(text)
    return chunks.filter((chunk: string) => chunk.trim().length > 50) // Filter out very short chunks
  } catch (error) {
    throw new Error(`Text chunking failed: ${(error as Error).message}`)
  }
}

const generateEmbeddings = async (chunks: string[]): Promise<ProcessedChunk[]> => {
  try {
    const vectors = await embeddings.embedDocuments(chunks)
    
    return chunks.map((chunk, index) => ({
      text: chunk,
      vector: vectors[index],
    }))
  } catch (error) {
    throw new Error(`Embedding generation failed: ${(error as Error).message}`)
  }
}

const storeDocumentMetadata = async (request: UploadRequest): Promise<void> => {
  const tableName = request.documentType === 'reference' ? 'references' : 'examples'
  
  const { error } = await supabase
    .from(tableName)
    .insert({
      file_id: request.fileId,
      user_id: request.userId,
      document_type: request.documentType,
      file_name: request.fileName,
      file_size: request.fileSize,
      uploaded_at: new Date().toISOString(),
    })
    .select('file_id')
    .maybeSingle()

  if (error && error.code === '23505') {
    return
  }

  if (error) {
    throw new Error(`Failed to store document metadata: ${error.message}`)
  }
}

const storeVectors = async (
  fileId: string,
  chunks: ProcessedChunk[],
  documentType: 'reference' | 'example'
): Promise<void> => {
  const tableName = documentType === 'reference' ? 'reference_vectors' : 'example_vectors'
  
  const vectorData = chunks.map(chunk => ({
    file_id: fileId,
    vector: chunk.vector,
    chunk_text: chunk.text,
    created_at: new Date().toISOString(),
  }))

  // Insert vectors in batches to avoid payload size limits
  const batchSize = 100
  for (let i = 0; i < vectorData.length; i += batchSize) {
    const batch = vectorData.slice(i, i + batchSize)
    
    const { error } = await supabase
      .from(tableName)
      .insert(batch)

    if (error) {
      throw new Error(`Failed to store vectors batch ${i / batchSize + 1}: ${error.message}`)
    }
  }
}

const processFile = async (request: UploadRequest): Promise<void> => {
  try {
    // Validate file
    const validationError = validateFile(request.fileName, request.fileSize)
    if (validationError) {
      throw new Error(validationError)
    }

    // Download file from storage
    const fileData = await downloadFile(request.storagePath)

    // Parse file content
    const text = await parseFile(fileData, request.fileName)
    
    if (!text || text.trim().length === 0) {
      throw new Error('File appears to be empty or could not be parsed')
    }

    // Chunk text
    const chunks = await chunkText(text)
    
    if (chunks.length === 0) {
      throw new Error('No valid text chunks could be extracted from the file')
    }

    // Generate embeddings
    const processedChunks = await generateEmbeddings(chunks)

    // Store document metadata
    await storeDocumentMetadata(request)

    // Store vectors
    await storeVectors(request.fileId, processedChunks, request.documentType)

  } catch (error) {
    // Clean up storage file if processing failed
    try {
      await supabase.storage
        .from(request.storagePath.split('/')[0])
        .remove([request.storagePath.split('/').slice(1).join('/')])
    } catch (cleanupError) {
      console.error('Failed to cleanup storage file:', cleanupError)
    }
    
    throw error
  }
}

serve(async (req: Request) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      })
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Parse request body
    const request: UploadRequest = await req.json()

    // Validate request
    if (!request.fileId || !request.fileName || !request.documentType || !request.storagePath) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Ensure user can only process their own files
    if (request.userId !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Process the file
    await processFile(request)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'File processed successfully',
        fileId: request.fileId,
        fileName: request.fileName,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Upload processor error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
