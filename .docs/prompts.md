To help you build the AI Research Paper Writer (ARPW) app using Cursor, I'll provide a set of structured prompts tailored for Cursor's AI-assisted coding capabilities. These prompts will guide Cursor to generate code for the key components of the app, aligning with the PRD, Technical Document, and User Stories previously outlined. The prompts are designed to be clear, specific, and modular to leverage Cursor’s ability to generate, edit, and organize code effectively. They focus on the MVP requirements, using Supabase for authentication (email/password only), storage, and vector database, Langchain for embeddings, and Grok (xAI API) for generation. Since you’re using Cursor, the prompts will assume you’re working in a JavaScript/TypeScript environment with React for the frontend.

Below are prompts for key components, organized by functionality (authentication, document management, paper generation, quality checks, export, and library/version management). Each prompt includes instructions for Cursor to create or modify files, specify dependencies, and adhere to the technical specs (e.g., RLS, Supabase, etc.). I'll also provide guidance on how to use these prompts in Cursor and iterate as needed.

### Using Prompts in Cursor
1. **Setup**: Ensure your project is initialized with a React app (`create-react-app` or Vite), Supabase client, and necessary dependencies. Use Cursor’s terminal to run:
   ```bash
   npm create vite@latest arpw -- --template react-ts
   cd arpw
   npm install @supabase/supabase-js @langchain/community pdf-parse docx marked tailwindcss
   ```
2. **Prompt Execution**: Paste each prompt into Cursor’s editor or use the Composer feature (Ctrl+Shift+I). Specify the file path (e.g., `src/components/Login.tsx`) to create or modify files. Cursor will generate code and suggest file structures.
3. **Iteration**: After generating code, review for errors or missing logic. Use Cursor’s inline suggestions (e.g., “Fix this function”) or ask follow-up prompts like “Add error handling to this component.”
4. **Supabase Setup**: Initialize Supabase (create project, enable `pgvector`, set up buckets: `references`, `examples`, `papers`). Copy your Supabase URL and anon key for the client.

### Prompts for Key Components

#### 1. Project Setup
**Prompt**:
```
Create a new React TypeScript project structure for the AI Research Paper Writer (ARPW) app. Set up the following:
- File: `src/supabaseClient.ts` to initialize Supabase client with URL and anon key (placeholder env vars).
- File: `src/types.ts` with TypeScript interfaces for UserProfile, Reference, Example, Paper, PaperReference, and enums (PaperType, CitationStyle, OutputFormat, Status).
- File: `src/App.tsx` with a basic router (react-router-dom) for routes: /login, /dashboard, /profile, /library.
- Install dependencies: @supabase/supabase-js, @langchain/community, pdf-parse, docx, marked, tailwindcss, react-router-dom.
- Configure Tailwind CSS in `index.css` and `tailwind.config.js`.
- Ensure all files include proper imports and exports.
```

**Notes**: Run this first to scaffold the project. Update `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` after generating.

#### 2. Authentication
**Prompt**:
```
 Create authentication components for ARPW using Supabase email/password auth (no OAuth). Implement:
- File: `src/components/Login.tsx`: Form for login/signup (email, password). On signup, create `user_profile` entry with `user_id` from `auth.users.user_id`. Use Supabase client (`supabaseClient.ts`).
- File: `src/components/Profile.tsx`: Form to update full name and store encrypted Grok API key in `user_profile`.
- File: `src/hooks/useAuth.ts`: Custom hook to manage auth state (current user, logout).
- Apply RLS: `SELECT`, `UPDATE` on `user_profile` where `user_id = auth.uid()`.
- Use Tailwind CSS for styling (responsive, WCAG 2.1 AA).
- Handle errors (e.g., invalid credentials) with user-friendly messages.
- Redirect to /dashboard on successful login/signup.
```

**Notes**: Use Cursor to generate SQL for `user_profile` table and RLS policies in Supabase dashboard.

#### 3. Document Management
**Prompt**:
```
Implement document upload and management for ARPW. Create:
- File: `src/components/UploadZone.tsx`: Drag-and-drop UI for references (up to 500) and examples (up to 10), max 10MB, PDF/DOC/TXT. Use Supabase Storage (`references`, `examples` buckets).
- File: `src/edge-functions/upload_processor.ts`: Supabase Edge Function to:
  - Validate file type/size.
  - Parse files (pdf-parse, docx, raw TXT).
  - Chunk text (500-1000 chars).
  - Embed using Langchain.js (all-MiniLM-L6-v2).
  - Store metadata in `references`/`examples` tables and vectors in `reference_vectors`/`example_vectors` (pgvector).
- File: `src/components/DocumentList.tsx`: Table to view/delete uploaded files (file name, size, date).
- Apply RLS: `SELECT`, `INSERT`, `DELETE` where `user_id = auth.uid()`.
- Show progress bar for batch uploads (50-100 files).
- Use Tailwind CSS; ensure accessibility.
```

**Notes**: Deploy `upload_processor.ts` via Supabase CLI (`supabase functions deploy`). Test parsing edge cases (e.g., malformed PDFs).

#### 4. Paper Generation
**Prompt**:
```
Implement paper generation for ARPW. Create:
- File: `src/components/PaperGenerator.tsx`: UI with:
  - Text area for research prompt.
  - Checkboxes for sections (Abstract, Introduction, Methods, Results, Discussion, Conclusion; default: all).
  - Radio buttons for paper type (Empirical Study, Literature Review, Theoretical Paper, Case Study) and citation style (APA only for MVP).
  - Buttons: "Generate Outline", "Generate Draft".
- File: `src/edge-functions/generate_paper.ts`: Edge Function to:
  - Retrieve top-k vectors (k=10-20) from `reference_vectors`/`example_vectors` using pgvector cosine similarity.
  - Construct RAG prompt with user prompt, sections, paper type, and vectors.
  - Call Grok API (Grok-4, user-provided key).
  - Save draft to `user_papers` (increment `version` for same title/user_id).
  - Store citations in `paper_references`.
- File: `src/components/OutlineEditor.tsx`: Editable Markdown preview for outline mode.
- Apply RLS on `user_papers`, `paper_references`.
- Use Tailwind CSS; ensure generation <5 min.
```

**Notes**: Test RAG prompt accuracy in Cursor’s debug mode. Ensure Grok API key is securely accessed.

#### 5. Quality Checks
**Prompt**:
```
Implement quality checks for ARPW drafts. Create:
- File: `src/edge-functions/run_checks.ts`: Edge Function to:
  - Check citations: Flag if >10% sentences lack `(Author, Year)`; verify against `paper_references`.
  - Check accuracy: Compare claims to `reference_vectors` (similarity >0.7); flag low-confidence.
  - Check format: Validate sections match `user_papers.sections` and APA structure (title page, headings).
- File: `src/components/Preview.tsx`: Display draft with inline warnings (e.g., "⚠ Methods: Uncited claim") and disclaimer: "AI-generated draft. Requires human review."
- Store flags in preview UI; allow basic text edits.
- Use Tailwind CSS for styling.
```

**Notes**: Use Cursor to iterate on regex for citation parsing if needed.

#### 6. Export
**Prompt**:
```
Implement export functionality for ARPW. Create:
- File: `src/components/Export.tsx`: UI with radio buttons for Word (.docx) or Markdown (.md) and "Export" button.
- File: `src/edge-functions/export_paper.ts`: Edge Function to:
  - For Markdown: Use `user_papers.content`.
  - For Word: Convert Markdown to DOCX using `docx` library.
  - Append checks summary and disclaimer.
  - Upload to Supabase Storage (`papers/{user_id}/{paper_id}.{ext}`).
- Provide download link in UI.
- Ensure export <10s; use Tailwind CSS.
```

**Notes**: Test DOCX formatting for APA compliance (e.g., headings, references).

#### 7. Library and Version History
**Prompt**:
```
Implement library and version management for ARPW. Create:
- File: `src/components/Library.tsx`: Table showing `user_papers` (title, created_at, status, version). Group by title; show versions expandable.
- Buttons for view, regenerate, delete per version.
- File: `src/edge-functions/manage_versions.ts`: Edge Function to:
  - Query `user_papers` by `user_id`, `title`, order by `version`.
  - Regenerate: Create new `user_papers` entry with incremented `version`.
  - Delete: Remove specific `paper_id` (RLS-checked).
- Apply RLS: `SELECT`, `INSERT`, `UPDATE`, `DELETE` where `user_id = auth.uid()`.
- Use Tailwind CSS; include deletion confirmation modal.
```

**Notes**: Use Cursor to generate table sorting/filtering logic.

### Additional Prompts for Iteration
- **Error Handling**:
  ```
  Add error handling to [file, e.g., src/components/UploadZone.tsx]. Handle:
  - Invalid file types/sizes.
  - Supabase Storage failures.
  - Network errors for Grok API.
  Display user-friendly messages with Tailwind-styled alerts.
  ```
- **Testing**:
  ```
  Generate Jest unit tests for [file, e.g., src/edge-functions/generate_paper.ts]. Test:
  - Vector retrieval accuracy.
  - Grok API response parsing.
  - Citation storage in `paper_references`.
  Include mock Supabase and Langchain dependencies.
  ```
- **SQL Setup**:
  ```
  Generate SQL for Supabase Postgres tables: `user_profile`, `references`, `examples`, `reference_vectors`, `example_vectors`, `user_papers`, `paper_references`. Include:
  - UUID primary keys.
  - Foreign keys to `auth.users.user_id`.
  - Enums for `paper_type`, `citation_style`, `output_format`, `status`.
  - RLS policies: `SELECT`, `INSERT`, `UPDATE`, `DELETE` where `user_id = auth.uid()`.
  Enable `pgvector` extension.
  ```

### Tips for Using Prompts in Cursor
- **File Creation**: Specify exact file paths to avoid duplicates (e.g., `src/components/Login.tsx`).
- **Composer Mode**: For multi-file changes (e.g., adding RLS across tables), use Composer and list all affected files.
- **Debugging**: If Cursor generates incorrect code (e.g., missing imports), highlight the error and ask, “Fix imports in this file” or “Add TypeScript types.”
- **Supabase CLI**: Deploy Edge Functions with `supabase functions deploy [function_name] --project-ref [project_id]`.
- **Testing**: Use Cursor’s terminal to run `npm test` for Jest; iterate with “Add test case for [scenario].”

### Example Workflow
1. Paste the Project Setup prompt to scaffold the app.
2. Use the SQL Setup prompt to create tables in Supabase.
3. Generate Authentication components, test login/signup in browser.
4. Proceed with Document Management, testing uploads in small batches.
5. Iterate through remaining prompts, checking each feature against user stories.
6. Use Testing prompt to ensure robustness.

If you need a specific prompt refined (e.g., more detail for a component) or additional prompts (e.g., for a specific Edge Function), let me know! You can also share generated code for review or debugging assistance.