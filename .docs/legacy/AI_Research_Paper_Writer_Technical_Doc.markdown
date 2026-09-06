# Technical Document: AI Research Paper Writer (ARPW)

## 1. Overview
This document outlines the technical implementation details for the ARPW MVP, a web-based application for generating research paper drafts. It covers the architecture, data models, key flows, security, performance optimizations, and testing strategies. The app uses Supabase for authentication, storage, and vector database, Langchain for embeddings, and Grok (xAI API) for text generation.

## 2. System Architecture
### Components
- **Frontend**: React.js (CDN-hosted via cdn.jsdelivr.net) with Tailwind CSS for styling; Supabase JavaScript client for interacting with auth, storage, and database.
- **Backend**: Supabase Edge Functions (Node.js) for processing uploads, vectorization, RAG, and quality checks.
- **Database**: Supabase Postgres with `pgvector` extension for vector storage.
- **Storage**: Supabase Storage for files (references, examples, exported papers).
- **AI**: Langchain.js for embeddings (Hugging Face all-MiniLM-L6-v2); xAI Grok API for generation.
- **External Services**: None beyond xAI API (user-provided key).

### High-Level Flow
1. User authenticates via Supabase Auth.
2. Uploads references/examples to Storage; Edge Functions parse and vectorize.
3. User configures paper (prompt, sections, type, citation style); Edge Function retrieves vectors, augments prompt, calls Grok.
4. Draft saved with metadata; checks run; export to Storage.

## 3. Data Models
### Tables
- **user_profile** (Stores user metadata):
  - `user_id` (UUID, primary key, foreign key to `auth.users.user_id`).
  - `email` (text, unique, synced from `auth.users`).
  - `full_name` (text, nullable).
  - `created_at` (timestamp, default now()).
  - `updated_at` (timestamp, default now()).
- **references** (Metadata for reference files):
  - `file_id` (UUID, primary key).
  - `user_id` (UUID, foreign key to `auth.users.user_id`).
  - `document_type` (enum: "reference").
  - `file_name` (text).
  - `file_size` (integer, max 10MB).
  - `uploaded_at` (timestamp).
- **examples** (Metadata for example files, same schema as references):
  - `file_id` (UUID, primary key).
  - `user_id` (UUID, foreign key to `auth.users.user_id`).
  - `document_type` (enum: "example").
  - `file_name` (text).
  - `file_size` (integer, max 10MB).
  - `uploaded_at` (timestamp).
- **reference_vectors** (Stores embeddings for references):
  - `vector_id` (UUID, primary key).
  - `file_id` (UUID, foreign key to `references`).
  - `vector` (vector, pgvector, 384 dims for all-MiniLM-L6-v2).
  - `chunk_text` (text, source chunk for traceability).
- **example_vectors** (Stores embeddings for examples, same schema as reference_vectors).
- **user_papers** (Stores generated drafts):
  - `paper_id` (UUID, primary key).
  - `user_id` (UUID, foreign key to `auth.users.user_id`).
  - `title` (text, user-defined or auto-generated from prompt).
  - `content` (text, Markdown of draft).
  - `sections` (text[], e.g., ["Abstract", "Introduction"]).
  - `paper_type` (enum: "Empirical Study", "Literature Review", "Theoretical Paper", "Case Study").
  - `citation_style` (enum: "APA", "MLA", "Chicago").
  - `output_format` (enum: "word", "markdown").
  - `version` (integer, auto-increment per title for same user_id).
  - `created_at` (timestamp).
  - `status` (enum: "draft", "completed").
- **paper_references** (Links papers to cited references):
  - `paper_id` (UUID, foreign key to `user_papers`).
  - `file_id` (UUID, foreign key to `references`).

### Row-Level Security (RLS)
- **Policy for all tables**: 
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` where `user_id = auth.uid()`.
  - For `paper_references`, enforce via join: `user_papers.user_id = auth.uid()`.
- Supabase Auth ensures `auth.uid()` is the logged-in user’s `auth.users.user_id`.

## 4. Key Technical Flows
### 4.1 User Authentication
- **Process**: 
  1. User signs up/logs in via Supabase Auth (email/password or OAuth: Google/GitHub).
  2. On first login, trigger creates `user_profile` entry with `user_id = auth.users.user_id`.
  3. Frontend stores session token for API calls.
- **Edge Function**: None required; Supabase Auth handles.

### 4.2 Document Upload and Vectorization
- **Process**:
  1. Frontend uploads file to Supabase Storage (`references` or `examples` bucket).
  2. Edge Function (`upload_processor`):
     - Validates file (<10MB, PDF/DOC/TXT).
     - Parses (pdf-parse for PDF, docx for DOC, raw for TXT).
     - Chunks text (500-1000 chars).
     - Embeds using Langchain.js (Hugging Face all-MiniLM-L6-v2).
     - Inserts metadata to `references`/`examples` and vectors to `reference_vectors`/`example_vectors`.
  3. Batch processing: Handle 50-100 files per batch (configurable).
- **Storage Path**: `references/{user_id}/{file_id}`, `examples/{user_id}/{file_id}`.
- **Performance**: <2 min per batch; async progress updates via WebSocket.

### 4.3 Paper Generation
- **Process**:
  1. User submits prompt, selects sections (array), paper type, citation style (APA for MVP).
  2. Edge Function (`generate_paper`):
     - Queries `reference_vectors`/`example_vectors` for top-k (k=10-20) using pgvector cosine similarity.
     - Constructs RAG prompt: `{user_prompt} + Use these refs: {top_k_refs} + Emulate style: {example_vectors}`.
     - Calls Grok API (Grok-4 endpoint, user-provided key).
     - Parses response for citations (regex: `(Author, Year)`).
     - Saves to `user_papers` (increment `version` if same title/user_id).
     - Links cited refs in `paper_references`.
- **Performance**: <5 min for full paper (500 refs).

### 4.4 Quality Checks
- **Edge Function (`run_checks`)**:
  - **Citations**: Scan content for `(Author, Year)`; flag if >10% sentences uncited; verify all citations in `paper_references`.
  - **Accuracy**: Compare key claims to `reference_vectors` (similarity >0.7); flag low-confidence.
  - **Format**: Validate sections match `user_papers.sections`; check APA (title page, headings).
- **Output**: Inline flags in preview (e.g., "⚠ Methods: Uncited claim").

### 4.5 Version Management
- **Process**:
  - Query `user_papers` by `user_id`, `title`, order by `version`.
  - Regenerate: Create new `user_papers` entry with incremented `version`.
  - Delete: Hard-delete old versions via UI (`DELETE FROM user_papers WHERE paper_id = ? AND user_id = auth.uid()`).
- **UI**: Library table shows versions; buttons for view/regenerate/delete.

### 4.6 Export
- **Process**:
  1. Edge Function (`export_paper`):
     - For Markdown: Use `user_papers.content`.
     - For Word: Convert Markdown to DOCX using `docx` library.
     - Append disclaimer: "AI-generated draft. Requires human review."
     - Upload to Storage (`papers/{user_id}/{paper_id}.{ext}`).
  2. Frontend provides download link.
- **Performance**: <10s per export.

## 5. Security
- **Authentication**: Supabase Auth (JWT tokens).
- **Authorization**: RLS on all tables (`user_id = auth.uid()`).
- **Storage**: Encrypted (Supabase default); private buckets with signed URLs.
- **Vectors**: Temp storage (delete after 24h or session end).
- **API Keys**: Store Grok key encrypted in `user_profile` (optional).
- **Data Privacy**: No external sharing; local processing where possible.

## 6. Performance Optimizations
- **Vectorization**: Batch processing (50-100 files); cache embeddings in memory during session.
- **Database**: Indexes on `user_id`, `title`, `version`, `file_id`.
- **Edge Functions**: Optimize for <2