# Supabase Edge Functions

This directory contains the Edge Functions for the ARPW application.

## Functions

### generate_paper

Section-by-section draft. Auth JWT required. Reads the Grok key with service_role `read_grok_api_key` (the SPA never sees it). Retrieves chunks itself — client `sourceIds` / `systemPrompt` are ignored. Drops `[S#]` citations that were not in the retrieved set. Missing key: HTTP 400 `missing_grok_key`.

POST body: `{ paperId, paperType, sections, researchPrompt, citationStyle?, outputFormat? }`. After Grok, updates that `user_papers` row and replaces `paper_references` with cited file ids the user owns.

### upload_processor

Processes uploaded documents by:
- Validating file type and size
- Parsing content (PDF, DOCX, TXT)
- Chunking text into manageable pieces
- Generating embeddings using Hugging Face all-MiniLM-L6-v2
- Storing metadata and vectors in the database

## Setup

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Initialize Supabase project:
   ```bash
   supabase init
   ```

3. Link to your Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy upload_processor
   ```

## Environment Variables

The function requires these environment variables to be set in your Supabase project:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## Dependencies

The function uses these external dependencies, managed through `deno.json`:
- `@supabase/supabase-js`: Supabase client
- `@langchain/community`: Langchain embeddings
- `langchain`: Text processing utilities
- `pdf-parse`: PDF parsing
- `docx`: DOCX parsing

All dependencies are configured in the `deno.json` file for proper import management.

## Configuration

Each Edge Function has its own `deno.json` file for dependency management. The `upload_processor/deno.json` file manages all imports and dependencies:

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.168.0/",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2",
    "@langchain/community": "https://esm.sh/@langchain/community@0.0.20",
    "langchain": "https://esm.sh/langchain@0.0.200",
    "pdf-parse": "https://esm.sh/pdf-parse@1.1.1",
    "docx": "https://esm.sh/docx@9.5.1"
  },
  "compilerOptions": {
    "allowJs": true,
    "lib": ["deno.window"],
    "strict": true
  }
}
```

This allows for clean imports in the Edge Function code without long URLs and provides proper isolation between functions.

### Best Practice: Individual deno.json Files

Each Edge Function should have its own `deno.json` file in its directory. This provides:

- **Isolation**: Each function manages its own dependencies
- **Version Control**: Different functions can use different versions of the same package
- **Maintainability**: Easier to update dependencies per function
- **Deployment**: Supabase can properly resolve imports for each function

## Usage

The function is called automatically when files are uploaded through the UploadZone component. It expects a POST request with:

```json
{
  "fileId": "uuid",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "documentType": "reference"
}
```

The function downloads `{auth.uid()}/{fileId}` from the `references` or `examples` bucket. It does not take `storagePath` or `userId` from the client.

## Error Handling

The function includes comprehensive error handling:
- File validation (type, size)
- Authentication verification
- Processing error recovery
- Automatic cleanup of failed uploads
