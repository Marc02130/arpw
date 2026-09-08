# GAP_ANALYSIS

## Overview

Gap analysis of ARPW as of 2026-09-07 (interrogation slices 1–5, QUAL-1–5, library export, NFR-4–7) against `.docs/PRODUCT_REQUIREMENTS.md`. Status values: **DONE**, **PARTIAL**, **MISSING**, **BROKEN**, **WRONG-BY-DESIGN**.

This is the document to use for planning work. The old `.docs/legacy/*.markdown` files describe a finished RAG product that does not exist.

## Content

### 1. One-line verdict

You can sign up, confirm email, reset a password, upload files, ingest them into 384-d vectors (`grok-embedding-small` with a Grok key, else `hash-384`; fixture PDF chunks visible in under 2 minutes when Storage is up), retrieve passages, pin them, interrogate the corpus (thread saved as notes), generate a section-by-section draft that prefers pins (if a Grok key is saved; one Grok section call aborts after 2 minutes), save it to the library, and preview with citation/format/uncited warnings plus a human-review disclaimer. Login, upload, and generate are keyboard-reachable. You cannot use outline mode.

### 2. Summary

| Area | Status | User-visible effect |
|---|---|---|
| Auth email/password | DONE | Open signup, confirm-before-access, password reset; profile row is not a login gate |
| Profile name | DONE | Saves full name |
| Grok key storage | DONE | Encrypted `user_grok_keys`; SPA sees last4 only |
| Reference upload UI | DONE | PDF/DOCX/TXT, 10 MB, 500 vs stored rows; list/delete. Live upload needs Storage up |
| Vector ingest | PARTIAL | TXT/DOCX/PDF parse, heading-aware chunk, `grok-embedding-small` when a Grok key is saved else `hash-384`. Live fixture ingest (no key) is hash-384 in &lt; 2 min when Storage is up |
| Retrieval | DONE | `match_reference_chunks` + Show passages; prefer stored section; filter by `embedding_model`; hosted Grok embed or hash-384 |
| Paper generation | DONE | Section loop + Grok + allow-list; draft saved to `user_papers` + `paper_references` |
| Interrogation / pins | DONE | Pins, Interrogate, generate prefers pins, chat notes persisted (not evidence) |
| Outline mode | MISSING | No control |
| Quality checks | DONE | QUAL-1–4: uncited, citation check, section headings, preview warnings + disclaimer. QUAL-5: no cosine “accuracy” score |
| Library | DONE | View, Continue, delete (confirm), regenerate (new version + generate), export Markdown/Word with disclaimer |
| Export | DONE | Library Markdown and Word downloads include checks summary and human-review disclaimer |
| Tests | PARTIAL | Unit `npm test` 27 files / 129 tests (2026-09-07). Integration `npm run test:integration` 13 files / 40 tests against local API with Storage and Edge up. Live Grok completion and live hosted embeddings are not in either suite. |
| Docs vs product | DONE | README matches generate/interrogate/pins/preview/export; outline still unbuilt |
| PII hygiene | DONE (this clone) | `.docs/*.pdf` ignored; old public SHA 404 |

### 3. Requirement trace

#### Auth

| ID | Status | Evidence |
|---|---|---|
| AUTH-1 | DONE | `Login.tsx` + `useAuth.tsx` `signUp` / `signInWithPassword` |
| AUTH-2 | DONE | persistSession, signOut, `Layout.tsx` |
| AUTH-3 | DONE | DB trigger `handle_new_user`; `ensureUserProfile` only after a confirmed session |
| AUTH-4 | DONE | `Profile.tsx` full name |
| AUTH-5 | DONE | Keys live in `user_grok_keys` (encrypted). SPA uses `set_grok_api_key` / `grok_api_key_status` (last4 only). `read_grok_api_key` is service_role |
| AUTH-6 | DONE | Error banner on login |
| AUTH-7 | DONE | `enable_confirmations = true`; gate is `email_confirmed_at`; `/verify-email` + resend |
| AUTH-8 | DONE | `/forgot-password`, `/reset-password`, `PASSWORD_RECOVERY` |

#### Documents

| ID | Status | Evidence |
|---|---|---|
| DOCS-1 | DONE | PDF/DOCX/TXT, 10 MB, metadata row on Storage upload, cap 500 vs existing rows + insert trigger |
| DOCS-2 | DONE | Same types as references; cap 10 vs stored rows + `examples_file_cap` trigger |
| DOCS-3 | DONE | Drag/drop, picker, per-file progress (`uploadProgress.ts` + tests) |
| DOCS-4 | DONE | List name/size/date/index status. Delete vectors, metadata row, then Storage key (`documentStore.ts`) |
| DOCS-5 | DONE | Parse TXT/DOCX/PDF; split on IMRaD headings; 1000/200 inside a section; store canonical `section` + PDF `page`. Embed `grok-embedding-small` (384-d) when a Grok key is saved, else hash-384. Layout/bbox parse still later |
| DOCS-6 | DONE | Client `validateUploadFile` + ingest `validateIngestFile` (pdf/docx/txt, 10 MB, not empty) |
| DOCS-7 | DONE | Client counts existing rows; DB triggers 500 on `"references"` and 10 on `examples` |
| DOCS-8 | DONE | `source_role` literature/primary; Upload tab splits literature vs original research (author’s work on this paper’s topic) |

#### Generation

| ID | Status | Evidence |
|---|---|---|
| GEN-1 | DONE (UI only) | Checkboxes in `PaperGenerationPage.tsx` |
| GEN-2 | DONE | `PaperType` select; frozen templates in `generationTemplates.ts`; worker uses the same module |
| GEN-3 | PARTIAL (UI) | APA/MLA/Chicago select; unused |
| GEN-4 | DONE | `match_reference_chunks`: prefer stored `section`, cosine ∪ FTS fused with RRF, filter by `embedding_model`. Hosted `grok-embedding-small` when a Grok key is saved, else hash-384 |
| GEN-5 | DONE | `generate_paper` loops selected sections with type×section templates + retrieval |
| GEN-6 | DONE | Unknown `[S#]` dropped in `stripUnknownCitations`; worker does not trust SPA source ids |
| GEN-7 | DONE | `match_example_chunks` + style prefix in the section prompt; example ids are not in the citation allow-list |
| GEN-8 | MISSING | No outline button |
| GEN-9 | DONE | Dashboard creates the draft; `generate_paper` writes content, sections, type, style, format, `status=completed` |
| GEN-10 | DONE | `paper_references` for cited `file_id`s the user owns; library shows the count |
| GEN-4 pins | DONE | Pins first (section or unscoped), then role-filtered vectors; examples rejected |

#### Interrogation and pins

| ID | Status | Evidence |
|---|---|---|
| INT-1 | DONE | `/generate/interrogate` + `InterrogatePanel` |
| INT-2 | DONE | Edge `interrogate_corpus`; same Grok key path; `match_reference_chunks` + strip unknown `[S#]` |
| INT-3 | DONE | `interrogation_turns` notes; RLS own rows; not in `match_reference_chunks` |
| PIN-1 | DONE | `pinned_passages`; Prompt list/unpin; Interrogate Pin with optional target section; cannot pin another user’s chunk or examples |
| PIN-2 | DONE | `retrieveForSection` / `generate_paper` merge pins first; Query sources matches |

Draft markdown is shown on the Prompt tab and stored on `user_papers`. Interrogation slices: `.docs/INTERROGATION_SLICES.md`.

#### Quality

| ID | Status | Evidence |
|---|---|---|
| QUAL-1 | DONE | `attributeSentences`: [S#] or quote span → chunk id; else uncited. Stored on `user_papers.attribution`. Not cosine. |
| QUAL-2 | DONE | `runCitationCheck`: every `[S#]` in the draft is in the retrieved/attributed set; cited file ids are in `paper_references`. Shown on generate draft and library preview. |
| QUAL-3 | DONE | `runFormatCheck`: each selected section has a `##` / `###` heading in the draft. Shown on generate and library preview. |
| QUAL-4 | DONE | `DraftPreview`: inline ⚠ on uncited sentences, warning list, footer disclaimer |
| QUAL-5 | DONE | Disclaimer and copy: not a factual-accuracy / cosine score |

#### Library

| ID | Status | Evidence |
|---|---|---|
| LIB-1 | DONE | Table UI lists `user_papers` |
| LIB-2 | DONE | Groups by title in memory |
| LIB-3 | DONE | View, delete (confirm), Continue, Regenerate (next version then `generate_paper`) |
| LIB-4 | DONE | Markdown and Word export with checks block and `DRAFT_DISCLAIMER` |
| LIB-5 | DONE | `referenceCountFromEmbed` on `paper_references(count)` |

#### NFR

| ID | Status | Evidence |
|---|---|---|
| NFR-1 | DONE | Table RLS plus Storage: objects only under `{auth.uid()}/` (`20260907150000_storage_object_rls.sql`). Live object E2E skips if Storage is down |
| NFR-2 | DONE | Object key `{user_id}/{file_id}` from JWT + file id on upload, delete, and ingest. Client `storagePath` is not used |
| NFR-3 | DONE here | gitignore `.docs/*.pdf`; current history has no PDF blobs |
| NFR-4 | DONE | Live `ingest.integration.test.ts`: fixture PDF → `upload_processor` → visible `hash-384` chunks containing `nfr7probe` in under `INGEST_VISIBLE_CHUNKS_MS` (120s). Skips if Storage or Edge is down |
| NFR-5 | DONE | `completeWithGrok` aborts after `GROK_SECTION_TIMEOUT_MS` (120s). Unit: hanging fetch times out; one-section draft after retrieval is under the budget. Live Grok E2E is still not in either suite |
| NFR-6 | DONE | Labeled login fields + submit; upload zone `role=button`, Enter/Space, focus ring; generate prompt/selects labeled; Query sources / Generate Paper native buttons; skip-to-main |
| NFR-7 | DONE | Fixture PDF unit + live ingest; retrieval hit on `nfr7probe`; `stripUnknownCitations` / generate drop unknown `[S#]`. Live Grok completion is not required for refuse-unknown-id |

### 4. Code vs old documentation

| Old claim (`.docs` / README features list) | Reality |
|---|---|
| React via cdn.jsdelivr.net | Vite SPA |
| Generation &lt; 5 min | One Grok section call aborts after 2 minutes (NFR-5) |
| Vectors deleted after 24h | Would destroy the corpus; not implemented (good) |
| Grok key on `user_profile` (plaintext) | Encrypted `user_grok_keys`; SPA sees last4 only |
| Storage `references/{user_id}/{file_id}` | Object key `{user_id}/{file_id}`; Storage RLS first path segment = `auth.uid()` |
| Quality checks, Word export, outline | QUAL-1–4 and Markdown/Word export shipped; outline (GEN-8) unbuilt |
| 90%+ check pass rate | Not a metric |

### 5. RAG design gaps (even after wiring Grok)

These are not “missing files.” They are product defects if you implement the old tech doc as written.

1. **Character chunking** — **PARTIAL.** Ingest splits on IMRaD headings and does not window across `References`. Generate retrieve prefers matching `section` then hybrid cosine+FTS (RRF). Inside a section still 1000/200 characters. No layout/bbox parse.
2. **Embeddings** — **PARTIAL.** Hosted plan is xAI `grok-embedding-small` at 384-d (same Grok key, not MiniLM-L6-v2). Hash-384 remains the fallback when no key or the API fails. Rows store `embedding_model`; retrieve filters by it. Live hosted E2E still needs a real xAI key.
3. **Top-k 10–20 for a whole paper** cannot ground Methods and Results. Retrieve per section.
4. **Regex `(Author, Year)`** is not citation correctness.
5. **Example papers in the same retriever** will be cited as evidence.

### 6. Dead code and duplication

- `src/pages/LoginPage.tsx` vs `src/components/Login.tsx` (router uses the latter)
- `src/pages/ProfilePage.tsx` vs `src/components/Profile.tsx`
- `src/edge-functions/` empty; real functions are `supabase/functions/upload_processor` and `generate_paper`

### 7. Recommended build order

Matches engineering, not README order.

| Phase | Work | Unlocks |
|---|---|---|
| 0 | Keep PII out of git; README that matches reality. Auth (confirm + reset) is shipped. | Trust |
| 1 | Storage path `{user_id}/{file_id}` shipped. Fixture PDF unit ingest shipped. Remaining: Storage up + live ingest E2E | Corpus |
| 2–5 | Generate slices in `.docs/GENERATION_SLICES.md` (`source_role`, templates, retrieval, Grok allow-list, save) | Grounded drafts |
| 6 | Interrogation slices in `.docs/INTERROGATION_SLICES.md` (pins, interrogate, generate uses pins) | Researcher-directed grounding |
| 7 | Attribution polish, library export | MVP cut line |
| 8 | Outline, eval harness | After MVP |

Do not start Word export or cosine “accuracy” before phase 3.

### 8. Local running snapshot (not a PRD gap)

Works today if Docker + `supabase start` (Homebrew CLI, not `npx`) + `.env` + Vite `:5173`:

- Sign up (any email); confirm via Mailpit/Inbucket at `:54324`; then the dashboard opens
- Password reset via the same inbox
- Dashboard form
- `npm test` (unit, no Docker)
- `npm run test:integration` (live Storage/ingest/generate-Grok cases skip if those services are down)
- Upload to Storage only if `supabase_storage_arpw` is up
- Generate if `generate_paper` is up and a Grok key is saved; successful generate saves to the library

Does not work: outline. Live hosted `grok-embedding-small` and live Grok completion need a real xAI key. Unconfirmed users cannot reach `/dashboard`.

## References

- `.docs/PRODUCT_REQUIREMENTS.md` — requirement IDs
- `.docs/TECHNICAL_SPECIFICATION.md` — architecture
- `.docs/INTERROGATION_SLICES.md` — pin + interrogate cut
- `src/pages/DashboardPage.tsx`
- `src/components/UploadZone.tsx`
- `src/hooks/useAuth.tsx`, `src/App.tsx`
- `supabase/functions/upload_processor/index.ts`
- `supabase/migrations/20260906133100_init.sql`
- `src/lib/*.test.ts`, `src/integration/*.integration.test.ts`
- `../README.md` — tests how-to and reference
- `.docs/legacy/` — superseded drafts
