# TECHNICAL_SPECIFICATION

## Overview

Technical specification for ARPW. It describes the **as-built** system as of 2026-09-07 (generate slices, interrogation slices 1–5, QUAL-1–5, library export, NFR-4–7) and the **target** RAG pipeline required by `.docs/PRODUCT_REQUIREMENTS.md`. Claims about running code cite files. Target design is labeled TARGET.

## Content

### 1. Stack (as-built)

| Layer | Choice | Notes |
|---|---|---|
| UI | React 18 + TypeScript + Vite 5 | `package.json`; Vite on port 5173 (`vite.config.ts`) |
| CSS | Tailwind 3 | `src/index.css`, `tailwind.config.js` |
| Routing | react-router-dom 6 | `src/App.tsx` |
| Auth / DB / Storage | Supabase (local CLI or hosted) | `@supabase/supabase-js` |
| Vectors | Postgres `vector` extension, 384 dims | `supabase/migrations/20260906133100_init.sql` |
| Ingest (as-built) | Deno Edge Function `upload_processor` | TXT/DOCX/PDF parse, chunk, `hash-384`. Live E2E needs Storage |
| Generation | Deno Edge Function `generate_paper` | Section loop, pins first, Grok, citation allow-list, save draft |
| Interrogation | Deno Edge Function `interrogate_corpus` | Grounded Q&A; notes on `interrogation_turns` |
| Embeddings (as-built) | Hashing trick, 384-d L2-normalized | `ingest.ts` `hashEmbedding`; column `embedding_model = hash-384` |
| Embeddings (TARGET) | MiniLM or hosted embed API | Same 384-d column; swap model id |
| LLM | xAI Grok `grok-4.3` via `https://api.x.ai/v1/chat/completions` | User key from `read_grok_api_key`; SPA sees last4; 120s abort per section (NFR-5) |
| Tests | Vitest 2 | `npm test` unit (26 files / 112); `npm run test:integration` live Auth/REST/RLS/Storage/ingest/pins. No live Grok completion |

Local run: Docker + `supabase start` (API `http://127.0.0.1:54321`, Studio `:54323`, mail UI `:54324`) and `npm run dev` on `:5173` (`server.host = true` so `127.0.0.1` works for auth redirects). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Integration tests also use `SUPABASE_SERVICE_ROLE_KEY` (local demo in `.env.example`; SPA must not). Use the installed Supabase CLI (`supabase start`), not `npx supabase`, or image tags can drift and Storage can fail to boot.

### 2. Runtime topology

```
Browser (Vite SPA)
  |  JWT
  +--> Supabase Auth
  +--> Postgres (RLS)  tables: user_profile, "references", examples,
  |                    reference_vectors, example_vectors, user_papers,
  |                    paper_references, pinned_passages, interrogation_turns
  +--> Storage buckets: references, examples, papers
  +--> Edge Function upload_processor  (service role)
  +--> Edge Function generate_paper     (JWT retrieve + service_role key read)
  +--> Edge Function interrogate_corpus (JWT retrieve + service_role key read)

TARGET:
  +--> retrieve RPC (hybrid search / MiniLM)
  +--> QUAL-3/4 polish / export_paper
```

The SPA must not hold the Grok key. `generate_paper` reads it with `read_grok_api_key` as service_role.

### 3. Routes (as-built)

| Path | Component actually mounted | Notes |
|---|---|---|
| `/login` | `src/components/Login.tsx` | `LoginPage.tsx` is unused |
| `/verify-email` | `src/components/VerifyEmail.tsx` | after signup or unconfirmed sign-in |
| `/forgot-password` | `src/components/ForgotPassword.tsx` | sends reset mail |
| `/reset-password` | `src/components/ResetPassword.tsx` | recovery session from email link |
| `/dashboard` | `src/pages/HomePage.tsx` | counts; start or continue a paper |
| `/generate` | `src/pages/PaperGenerationPage.tsx` | Prompt tab |
| `/generate/upload` | same | Upload tab: literature, original research, examples |
| `/generate/interrogate` | same | Interrogate tab: grounded Q&A; Pin on passages with optional target section |
| `/profile` | `src/components/Profile.tsx` | `ProfilePage.tsx` is unused |
| `/library` | `src/pages/LibraryPage.tsx` | list/view stubs |
| `*` | redirect | |

Auth gate (`App.tsx`): `user && email_confirmed_at && !isRecovery`. A missing `user_profile` row no longer blocks the app; `Layout` falls back to email / `user_metadata.full_name`. Unconfirmed sessions go to `/verify-email`. A recovery session stays on `/reset-password` until the password is updated.

### 4. Data model (as-built)

Source of truth: `supabase/migrations/20260906133100_init.sql`, `20260907000000_grok_key_storage.sql`, `20260907010000_reference_upload_cap.sql`. Table `"references"` is quoted because `references` is reserved.

**user_profile:** `user_id` PK → `auth.users`, `email`, `full_name`, timestamps. Grok keys are **not** on this table.

**user_grok_keys:** `user_id` PK → `auth.users`, `ciphertext bytea` (`pgp_sym_encrypt`), `last4 text`, `updated_at`. RLS on; **no** `GRANT` to `anon` or `authenticated`. Wrapping secret: `private.secrets` where `id = 'grok_key_enc'` (not in the API schema).

| RPC | Role | Args | Returns |
|---|---|---|---|
| `set_grok_api_key(api_key text)` | authenticated | trimmed, length ≥ 10 | `{ set: true, last4 }` |
| `clear_grok_api_key()` | authenticated | | `{ set: false, last4: null }` |
| `grok_api_key_status()` | authenticated | | `{ set, last4 }` |
| `read_grok_api_key(for_user uuid)` | service_role | owner uuid | plaintext or null |

SPA: `useAuth.tsx` `setGrokApiKey` / `clearGrokApiKey` / `grokKey`; `Profile.tsx` never `select`s ciphertext. How-to: `../README.md#how-to-save-a-grok-api-key`.

**"references":** `file_id`, `user_id`, `document_type` must be `reference`, `file_name` must match `\.(pdf\|docx\|txt)$`, `file_size` 1..10 MiB, `uploaded_at`. Trigger `references_file_cap`: max 500 rows per `user_id`. How-to: `../README.md#how-to-upload-a-reference`.

`source_role text NOT NULL DEFAULT 'literature' CHECK (source_role IN ('literature', 'primary'))` (`20260907160000_reference_source_role.sql`). `literature` = published work to cite. `primary` = the author’s original research on this paper’s topic. Example papers do **not** have this column. Paper generation Upload tab: two sections, same table. Role select can recategorize.

**examples:** same shape except `document_type = 'example'`. `file_name` must match `\.(pdf|docx|txt)$`. Trigger `examples_file_cap`: max 10 rows per `user_id`.

**reference_vectors / example_vectors:** `vector_id`, `file_id`, `vector vector(384)`, `chunk_text`, `chunk_index`, `section`, `embedding_model` (`hash-384`). TARGET: page/doi/authors; MiniLM or hosted embeddings in the same 384-d column.

**user_papers:** `paper_id`, `user_id`, `title`, `content`, `sections text[]`, `paper_type`, `citation_style`, `output_format`, `version`, `status` (`draft`/`completed`).

**paper_references:** (`paper_id`, `file_id`).

**pinned_passages:** `pin_id`, `user_id`, `paper_id`, `file_id`, `vector_id`, optional `target_section` (PAPER_SECTIONS or null), `created_at`. Unique `(paper_id, vector_id)`. Composite FKs: paper and file must belong to `user_id`; vector must belong to that `file_id` on `reference_vectors` (example-paper chunks cannot be pinned). RLS own rows only. Prompt tab lists/unpins; Query sources and Interrogate can pin.

**interrogation_turns:** `turn_id`, `user_id`, `paper_id`, `role` (`user`|`assistant`), `content`, optional `filter_role`, `passages jsonb` (display/pin metadata only), `created_at`. RLS own insert/select. Not in `reference_vectors` or `match_reference_chunks`. Never numbered as generate `[S#]` evidence.

RLS: row owner = `auth.uid()`; vector tables via EXISTS to parent file. Storage policies: authenticated CRUD only when `split_part(name, '/', 1) = auth.uid()::text` and the key is `{uid}/…` (`20260907150000_storage_object_rls.sql`).

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

`UploadZone.tsx` (references: `maxFiles={500}`):

1. Reject empty files, size > 10 MB, and extensions other than `.pdf` / `.docx` / `.txt`.
2. `count(*)` existing rows for `auth.uid()`; refuse if `existing + batch > maxFiles`.
3. Upload to bucket `references` or `examples` as `{user_id}/{file_id}`.
4. Insert the metadata row. If insert fails, delete the Storage object.
5. Invoke `upload_processor`. Failure is logged; the file stays stored.

`upload_processor` (`ingest.ts` + `index.ts`):

- Bucket from `documentType`; object key `{user.id}/{fileId}` via `storageTarget` / `storageObjectKey`. Client `storagePath` and `userId` are not sent. JWT `user.id` owns the row.
- TXT: `TextDecoder`. DOCX: unzip `word/document.xml` (`fflate`) then `textFromDocxXml`. PDF: `unpdf`.
- Chunks: 1000/200, min 50 chars, `chunk_index` + `section` (first line).
- Embeddings: hashing trick, 384-d L2-normalized, `embedding_model = hash-384`. TARGET: MiniLM or hosted embed API (same dimension).
- Duplicate metadata insert: ignore unique violation `23505`. Failed ingest does **not** delete Storage.

`DocumentList.tsx` lists name, size, date, and index status (`Stored (not indexed)` vs chunk count). Delete order: vector rows, metadata row, Storage object `storageObjectKey(user.id, fileId)` (same helper as upload).

### 7. Generation (as-built vs TARGET)

`supabase/functions/generate_paper/index.ts`. Shared loop/templates/allow-list: `supabase/functions/_shared/` (re-exported from `src/lib`). UI: `PaperGenerationPage` Prompt tab.

Build order: `.docs/GENERATION_SLICES.md`. Slices 1–5 shipped.

**Who writes which prompt**

| Text | Owner | MVP |
|---|---|---|
| Research prompt (topic / question / constraints) | User, Prompt tab textarea | Yes (GEN-1) |
| Paper type × section retrieval suffix + generation instructions | Server module, frozen | Yes (GEN-2, GEN-5) |
| System prompt / per-section template editor | User | No |
| Extra notes appended to every section | User | Deferred |

The SPA must not send a system prompt to Grok. Templates live in `supabase/functions/_shared/generationTemplates.ts` (`getSectionTemplate`, `buildRetrievalQuery`, `buildGenerationPrompt`). The worker imports that module; there is no system-prompt argument. Client `sourceIds` / `systemPrompt` fields are ignored.

**`source_role` and retrieval**

Join `reference_vectors` to `"references"`. Filter `user_id = auth.uid()`. Then:

| Section | Chunks to search (after pins) |
|---|---|
| Abstract, Introduction | `literature`; also `primary` unless the paper type is Literature Review |
| Literature Review | `literature` only |
| Methods, Results | `primary` first; if none, `literature` |
| Discussion, Conclusion | both |
| References | none (built from cited ids) |

Paper type **Literature Review**: `literature` only; ignore `primary`.

Example-paper vectors: `match_example_chunks` + style prefix on the section prompt. Never numbered as `[S#]`, never mixed into the citation allow-list (GEN-7).

**Pins and interrogation**

See `.docs/INTERROGATION_SLICES.md`. As-built: `pinned_passages` (slice 1). Interrogate tab `/generate/interrogate` + Edge `interrogate_corpus` (slice 2): user question, `literature` / `primary` / `both` filter, `match_reference_chunks` (no examples), Grok, `stripUnknownCitations`. Turns persist on `interrogation_turns` (notes). Prompt tab lists/unpins; Query sources and Interrogate can pin literature/primary chunks (optional `target_section`). Generate allow-list = pins for that section (or unscoped) ∪ role-filtered `match_reference_chunks` (PIN-2). Example pins and chat notes are not evidence. Literature Review paper type ignores `primary`. Abstract/Introduction also union primary when this is not a literature-review paper.

**Pipeline**

1. Embed the research prompt (same model as chunks; store model id on rows). Hash-384 is acceptable until MiniLM.
2. For each selected section, take pins for that section or unscoped, then rewrite the retrieval query from the frozen template (e.g. “Methods: …” + research prompt) and apply the role filter above. Dedup by `vector_id`.
3. SQL RPC `match_reference_chunks(query_embedding, match_count, filter_role)`: cosine on `reference_vectors`, `auth.uid()`, optional `source_role`. k capped at 20. As-built: hash-384 query embedding from `buildRetrievalQuery`. Full-text/rerank later.
4. Optional rerank later.
5. Prompt Grok with the section template, research prompt, and retrieved passages. Instruct: only cite `source_id`s in that set; quote or paraphrase with `[S12]`. Each `completeWithGrok` call aborts after 2 minutes (NFR-5, `GROK_SECTION_TIMEOUT_MS`).
6. Parse output; **drop unknown ids** (GEN-6, NFR-7).
7. Concatenate sections. Update the existing `user_papers` row (`content`, sections, type, optional style/format, `status=completed`). Replace `paper_references` with cited `file_id`s that exist in the user’s `"references"` table. Client-supplied source ids are ignored.
8. QUAL-2 `runCitationCheck`: remaining `[S#]` must be in the attributed/retrieved set; cited file ids must be in `paper_references`. Shown on the Prompt draft and library preview. Not a cosine accuracy score.
9. QUAL-3 `runFormatCheck`: each section stored on the paper (`user_papers.sections`) must appear as a `##` or `###` heading in `content`.
10. QUAL-4 preview (`DraftPreview`): uncited sentences marked ⚠ inline; citation/format warnings listed; footer disclaimer. Not a cosine accuracy score.

Grok key: worker calls `read_grok_api_key(for_user)` as service_role. If no key, HTTP 400 `missing_grok_key` (“Save a Grok API key on Profile before generating.”). Model: `grok-4.3`. Retrieval uses the caller’s JWT so RLS applies; the service role is only for the key.

### 8. Library and export (as-built vs TARGET)

Library reads `user_papers`, groups by title, shows latest version. Source count comes from `paper_references(count)`. View uses `DraftPreview`. Delete confirms then removes the row. **Regenerate** inserts `version+1` for the same title (`createRegenerateDraft`) then calls `generate_paper`; the empty row is deleted if generate fails. **Export** downloads Markdown or Word (`docx`) with a checks summary and `DRAFT_DISCLAIMER`. Files are not uploaded to the `papers` bucket (TARGET).

### 9. Security (as-built)

| Topic | State |
|---|---|
| Table RLS | Present |
| Storage RLS | Authenticated users only `{auth.uid()}/*` in references/examples/papers |
| Grok key | Encrypted `user_grok_keys`; SPA cannot SELECT ciphertext |
| Edge service role | Bypasses RLS; downloads `{user.id}/{fileId}` |
| PII in git | Blocked by `.docs/*.pdf` gitignore; history of old public repo deleted |
| Tests | Unit + Auth/REST/RLS/pins/notes. Storage object isolation and ingest E2E (NFR-4 timing) run when those services are up. Grok section timeout unit-tested. No live Grok completion |

### 10. Public surface (files)

Frontend: `src/App.tsx`, `src/main.tsx`, `src/supabaseClient.ts`, `src/hooks/useAuth.tsx`, `src/components/{Login,VerifyEmail,ForgotPassword,ResetPassword,Layout,Profile,UploadZone,DocumentList,InterrogatePanel,DraftPreview,AuthShell,AuthAlert}.tsx`, `src/pages/{HomePage,PaperGenerationPage,DashboardPage,LibraryPage}.tsx`, `src/lib/*`.

Backend: `supabase/functions/upload_processor/{index.ts,ingest.ts}`, `supabase/functions/generate_paper/index.ts`, `supabase/functions/interrogate_corpus/index.ts`, `supabase/functions/_shared/`, `supabase/migrations/` (init through `pinned_passages` and `interrogation_turns`), `supabase/config.toml`.

Tests: `src/lib/*.test.ts`, `src/integration/*.integration.test.ts`, `src/integration/supabaseTest.ts`, `vite.config.ts` `test`, `vitest.integration.config.ts`.

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

### 12. Tests (as-built)

Two Vitest suites. `npm test` is the default and must not require Docker.

| Suite | Command | Config | What it is |
|---|---|---|---|
| Unit | `npm test` | `vite.config.ts`: include `src/**/*.test.ts`, exclude `*.integration.test.ts` | Pure helpers: validate file/auth, caps, progress, document store, ingest parse/chunk/hash, NFR-7 fixture PDF, Grok 2-minute abort, keyboard-flow control ids |
| Integration | `npm run test:integration` | `vitest.integration.config.ts`: include `src/**/*.integration.test.ts`, 30s timeout (ingest NFR-4 uses 130s), no file parallelism | Live local Auth, PostgREST, Postgres: confirmations, Grok RPCs, CHECKs, caps, table RLS, Storage policy names. Live Storage/ingest skip if those services are down |

Integration helper `src/integration/supabaseTest.ts`: health-check `/auth/v1/health`; `signUp` then `admin.updateUserById({ email_confirm: true })` because `enable_confirmations = true`; local demo JWT fallback; `deleteUser` cleanup. Service role is for confirm/admin seed only; user JWTs exercise RLS.

Not as-built: live `upload_processor` HTTP while Storage/Edge are down; live Grok completion while `generate_paper` is down or no key. Unit tests cover refuse-unknown-citation-id (NFR-7) and the 2-minute Grok abort (NFR-5).

How-to and file tables: `../README.md#how-to-run-tests`, `../README.md#tests`. Why the split: `../README.md#why-two-test-suites`.

## References

- `.docs/PRODUCT_REQUIREMENTS.md`
- `.docs/GAP_ANALYSIS.md`
- `src/supabaseClient.ts`, `src/pages/DashboardPage.tsx`, `src/components/UploadZone.tsx`
- `supabase/functions/upload_processor/index.ts`
- `supabase/migrations/20260906133100_init.sql`
- `supabase/migrations/20260907000000_grok_key_storage.sql`
- `supabase/migrations/20260907010000_reference_upload_cap.sql`
- `README.md` (local setup, Grok key how-to and RPCs, tests)
- `.docs/GENERATION_SLICES.md`
- `.docs/INTERROGATION_SLICES.md`
- `src/lib/*.test.ts`, `src/integration/*.integration.test.ts`
