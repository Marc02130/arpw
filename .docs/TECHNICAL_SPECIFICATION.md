# TECHNICAL_SPECIFICATION

## Overview

Technical specification for ARPW. It describes the **as-built** system on `main` (2026-09-06, after `feat/fix-login`) and the **target** RAG pipeline required by `.docs/PRODUCT_REQUIREMENTS.md`. Claims about running code cite files. Target design is labeled TARGET.

## Content

### 1. Stack (as-built)

| Layer | Choice | Notes |
|---|---|---|
| UI | React 18 + TypeScript + Vite 5 | `package.json`; Vite on port 5173 (`vite.config.ts`) |
| CSS | Tailwind 3 | `src/index.css`, `tailwind.config.js` |
| Routing | react-router-dom 6 | `src/App.tsx` |
| Auth / DB / Storage | Supabase (local CLI or hosted) | `@supabase/supabase-js` |
| Vectors | Postgres `vector` extension, 384 dims | `supabase/migrations/20260906133100_init.sql` |
| Ingest (written, not proven on Edge) | Deno Edge Function `upload_processor` | `supabase/functions/upload_processor/index.ts` |
| Generation | Not implemented | `DashboardPage.tsx` TODO / alert |
| Embeddings (intended) | Hugging Face `all-MiniLM-L6-v2` via Langchain | Edge function; wrong runtime for Transformers.js |
| LLM (intended) | xAI Grok, user-supplied key | Profile field `grok_api_key` plaintext |

Local run: Docker + `supabase start` (API `http://127.0.0.1:54321`, Studio `:54323`, mail UI `:54324`) and `npm run dev` on `:5173` (`server.host = true` so `127.0.0.1` works for auth redirects). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Use the installed Supabase CLI (`supabase start`), not `npx supabase`, or image tags can drift and Storage can fail to boot.

### 2. Runtime topology

```
Browser (Vite SPA)
  |  JWT
  +--> Supabase Auth
  +--> Postgres (RLS)  tables: user_profile, "references", examples,
  |                    reference_vectors, example_vectors, user_papers,
  |                    paper_references
  +--> Storage buckets: references, examples, papers
  +--> Edge Function upload_processor  (service role)

TARGET:
  +--> retrieve RPC (hybrid search)
  +--> generate_paper (section loop, Grok)
  +--> run_checks / export_paper
```

The SPA must not hold the Grok key. TARGET: Edge Function or worker reads the key from Vault / encrypted column the client cannot select.

### 3. Routes (as-built)

| Path | Component actually mounted | Notes |
|---|---|---|
| `/login` | `src/components/Login.tsx` | `LoginPage.tsx` is unused |
| `/verify-email` | `src/components/VerifyEmail.tsx` | after signup or unconfirmed sign-in |
| `/forgot-password` | `src/components/ForgotPassword.tsx` | sends reset mail |
| `/reset-password` | `src/components/ResetPassword.tsx` | recovery session from email link |
| `/dashboard` | `src/pages/DashboardPage.tsx` | upload + generate form |
| `/profile` | `src/components/Profile.tsx` | `ProfilePage.tsx` is unused |
| `/library` | `src/pages/LibraryPage.tsx` | list/view stubs |
| `*` | redirect | |

Auth gate (`App.tsx`): `user && email_confirmed_at && !isRecovery`. A missing `user_profile` row no longer blocks the app; `Layout` falls back to email / `user_metadata.full_name`. Unconfirmed sessions go to `/verify-email`. A recovery session stays on `/reset-password` until the password is updated.

### 4. Data model (as-built)

Source of truth: `supabase/migrations/20260906133100_init.sql` plus `20260907000000_grok_key_storage.sql`. Table `"references"` is quoted because `references` is reserved.

**user_profile:** `user_id` PK → `auth.users`, `email`, `full_name`, timestamps. Grok keys are **not** on this table.

**user_grok_keys:** `user_id` PK → `auth.users`, `ciphertext bytea` (`pgp_sym_encrypt`), `last4 text`, `updated_at`. RLS on; **no** `GRANT` to `anon` or `authenticated`. Wrapping secret: `private.secrets` where `id = 'grok_key_enc'` (not in the API schema).

| RPC | Role | Args | Returns |
|---|---|---|---|
| `set_grok_api_key(api_key text)` | authenticated | trimmed, length ≥ 10 | `{ set: true, last4 }` |
| `clear_grok_api_key()` | authenticated | | `{ set: false, last4: null }` |
| `grok_api_key_status()` | authenticated | | `{ set, last4 }` |
| `read_grok_api_key(for_user uuid)` | service_role | owner uuid | plaintext or null |

SPA: `useAuth.tsx` `setGrokApiKey` / `clearGrokApiKey` / `grokKey`; `Profile.tsx` never `select`s ciphertext. How-to: `../README.md#how-to-save-a-grok-api-key`.

**"references" / examples:** `file_id`, `user_id`, `document_type`, `file_name`, `file_size` (1..10 MiB), `uploaded_at`.

**reference_vectors / example_vectors:** `vector_id`, `file_id`, `vector vector(384)`, `chunk_text`. No page, section, doi, authors, chunk_index, embedding_model. TARGET: add those columns.

**user_papers:** `paper_id`, `user_id`, `title`, `content`, `sections text[]`, `paper_type`, `citation_style`, `output_format`, `version`, `status` (`draft`/`completed`).

**paper_references:** (`paper_id`, `file_id`).

RLS: row owner = `auth.uid()`; vector tables via EXISTS to parent file. Storage policies: authenticated CRUD on the three buckets (loose; TARGET: prefix by `user_id`).

IVFFlat indexes are **not** created at init (empty corpus). TARGET: HNSW after data exists.

Triggers: `handle_new_user` inserts profile (`ON CONFLICT DO NOTHING`). After a confirmed session, `ensureUserProfile` in `useAuth.tsx` inserts if the trigger missed (ignores unique conflicts). Signup itself does not insert a profile from the client.

### 5. Auth (as-built)

`src/hooks/useAuth.tsx` is an `AuthProvider` (wrapped in `src/main.tsx`). One shared state: session, profile, `isRecovery`, `isEmailConfirmed`, `grokKey` (`{ set, last4 }`).

- `signUp`: `emailRedirectTo` → `{origin}/login`. Success with no session means confirmation is required.
- `signInWithPassword`: unconfirmed accounts are rejected (`email_not_confirmed` or missing `email_confirmed_at`); UI sends them to `/verify-email`.
- `resetPasswordForEmail` → `{origin}/reset-password`; `updateUser({ password })` clears recovery.
- `resend({ type: 'signup' })` on the verify screen.
- `onAuthStateChange`: `PASSWORD_RECOVERY` sets `isRecovery`.

`supabase/config.toml`: `[auth.email] enable_confirmations = true`. Redirect allow-list includes `/login`, `/reset-password`, `/verify-email` for both `127.0.0.1` and `localhost`. Local mail is Mailpit/Inbucket on `:54324`.

Client: one `createClient` in `src/supabaseClient.ts`, `storageKey: 'arpw-auth'`.

### 6. Upload path (as-built)

`UploadZone.tsx`:

1. Validate extension (`.pdf/.doc/.docx/.txt`) and 10 MB.
2. Upload to bucket `references` or `examples` as `{uuid}_{originalName}`.
3. Invoke `upload_processor` with `fileId`, `fileName`, `fileSize`, `documentType`, `storagePath` (`uploadData.path`), `userId`.

`maxFiles` is checked against the **current FileList**, not DB counts.

`DocumentList.tsx` lists and deletes. Storage delete uses `{fileId}_{fileName}`. DB delete relies on FK cascade for vectors. Storage path on delete matches upload shape.

**upload_processor (TARGET fixes required):**

- Uses service role; checks JWT then `request.userId === user.id`.
- Downloads via `storagePath.split('/')` as bucket + key. Client sends a bare object key, so bucket becomes the filename. Ingest cannot work until the function uses the known bucket and key.
- Client-supplied `storagePath` is an IDOR risk with service role.
- PDF: `pdf-parse` + Node `Buffer` on Deno.
- DOCX: `docx` package **writes** Word files; it does not extract text. TARGET: mammoth or unzip + document.xml.
- `.doc` rejected at runtime after the UI accepted it.
- Chunking: `RecursiveCharacterTextSplitter` 1000 / 200 overlap; drop chunks &lt; 50 chars.
- Embeddings: `HuggingFaceTransformersEmbeddings` (`all-MiniLM-L6-v2`) inside Edge. TARGET: hosted embedding API or a Node/Python worker.

### 7. Generation (TARGET)

No `generate_paper` function. UI:

```ts
// src/pages/DashboardPage.tsx
alert('Paper generation feature will be implemented in the next phase')
```

TARGET pipeline:

1. Embed the user prompt (same model as chunks; store model id on rows).
2. For each selected section, rewrite a retrieval query (e.g. “Methods: …” + prompt).
3. SQL RPC: cosine + full-text, filter `user_id`, return `chunk_text`, `file_id`, `section`, `page`, score. k ≈ 8–20 **per section**.
4. Optional rerank.
5. Prompt Grok: only cite `source_id`s in the retrieved set; quote or paraphrase with `[S12]`.
6. Parse output; drop unknown ids.
7. Concatenate sections; insert `user_papers`; insert `paper_references`.

Example-paper vectors: style prefix only, never mixed into evidence.

### 8. Library and export (as-built vs TARGET)

Library reads `user_papers`, groups by title, shows latest version. `referenceCount` hardcoded `0`. Regenerate and Export buttons are no-ops. Preview modal shows `content` as `<pre>`.

TARGET: `export_paper` writes Markdown as stored; Word via `docx` (generation library, correct use); upload to `papers/{user_id}/{paper_id}.ext`; disclaimer footer.

### 9. Security (as-built)

| Topic | State |
|---|---|
| Table RLS | Present |
| Storage RLS | Authenticated access to whole buckets |
| Grok key | Encrypted `user_grok_keys`; SPA cannot SELECT ciphertext |
| Edge service role | Bypasses RLS; trusts client path |
| PII in git | Blocked by `.docs/*.pdf` gitignore; history of old public repo deleted |
| Tests | None (`package.json` has no test script) |

### 10. Public surface (files)

Frontend: `src/App.tsx`, `src/main.tsx`, `src/supabaseClient.ts`, `src/hooks/useAuth.tsx`, `src/components/{Login,VerifyEmail,ForgotPassword,ResetPassword,Layout,Profile,UploadZone,DocumentList,AuthShell,AuthAlert}.tsx`, `src/pages/{DashboardPage,LibraryPage}.tsx`.

Backend: `supabase/functions/upload_processor/index.ts`, `supabase/migrations/20260906133100_init.sql`, `supabase/migrations/20260907000000_grok_key_storage.sql`, `supabase/config.toml`.

Dead: `LoginPage.tsx`, `ProfilePage.tsx`, empty `src/edge-functions/`.

### 11. TARGET retrieval RPC (sketch)

```sql
-- TARGET, not in repo yet
create or replace function match_reference_chunks(
  query_embedding vector(384),
  match_count int,
  filter_user uuid
)
returns table (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  score float
)
language sql
stable
as $$
  select v.vector_id, v.file_id, v.chunk_text,
         1 - (v.vector <=> query_embedding) as score
  from reference_vectors v
  join "references" r on r.file_id = v.file_id
  where r.user_id = filter_user
  order by v.vector <=> query_embedding
  limit match_count;
$$;
```

Call only with the user’s JWT so RLS still applies if rewritten without `filter_user`. Prefer `auth.uid()` inside the function instead of a client-supplied uuid.

## References

- `.docs/PRODUCT_REQUIREMENTS.md`
- `.docs/GAP_ANALYSIS.md`
- `src/supabaseClient.ts`, `src/pages/DashboardPage.tsx`, `src/components/UploadZone.tsx`
- `supabase/functions/upload_processor/index.ts`
- `supabase/migrations/20260906133100_init.sql`
- `supabase/migrations/20260907000000_grok_key_storage.sql`
- `README.md` (local setup, Grok key how-to and RPCs)
