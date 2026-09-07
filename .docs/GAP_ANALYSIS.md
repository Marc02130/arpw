# GAP_ANALYSIS

## Overview

Gap analysis of ARPW as of 2026-09-07 (`feat/integration-tests`, after ingest hash-384 and Auth/REST integration tests) against `.docs/PRODUCT_REQUIREMENTS.md`. Status values: **DONE**, **PARTIAL**, **MISSING**, **BROKEN**, **WRONG-BY-DESIGN**.

This is the document to use for planning work. The old `.docs/legacy/*.markdown` files describe a finished RAG product that does not exist.

## Content

### 1. One-line verdict

You can sign up, confirm email, reset a password, upload files, and ingest them into 384-d hash vectors. You cannot retrieve, generate, check, or export a paper. MiniLM embeddings are still TARGET.

### 2. Summary

| Area | Status | User-visible effect |
|---|---|---|
| Auth email/password | DONE | Open signup, confirm-before-access, password reset; profile row is not a login gate |
| Profile name | DONE | Saves full name |
| Grok key storage | DONE | Encrypted `user_grok_keys`; SPA sees last4 only |
| Reference upload UI | DONE | PDF/DOCX/TXT, 10 MB, 500 vs stored rows; list/delete. Live upload needs Storage up |
| Vector ingest | PARTIAL | TXT/DOCX/PDF parse, chunk, hash-384 embed, store when the object exists. MiniLM still TARGET. No ingest E2E while Storage is down |
| Retrieval | MISSING | No match RPC, no UI of passages |
| Paper generation | MISSING | Alert: “next phase” |
| Outline mode | MISSING | No control |
| Quality checks | MISSING | Spec’d checks would not measure grounding anyway |
| Library | PARTIAL | Lists papers if any exist; regenerate/export no-ops; count is 0 |
| Export | MISSING | Button does nothing |
| Tests | PARTIAL | Unit (`npm test`) plus Auth/REST/RLS integration (`npm run test:integration`). No Storage/ingest E2E |
| Docs vs product | DONE | README states generation/retrieval/export are unbuilt; `.docs/` holds PRD/spec/gap |
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
| DOCS-5 | DONE | Bucket from `documentType`; TXT/DOCX/PDF parse; chunk+section; `hash-384` vectors. MiniLM still TARGET |
| DOCS-6 | DONE | Client `validateUploadFile` + ingest `validateIngestFile` (pdf/docx/txt, 10 MB, not empty) |
| DOCS-7 | DONE | Client counts existing rows; DB triggers 500 on `"references"` and 10 on `examples` |

#### Generation

| ID | Status | Evidence |
|---|---|---|
| GEN-1 | DONE (UI only) | Checkboxes in `DashboardPage.tsx` |
| GEN-2 | DONE (UI only) | `PaperType` select |
| GEN-3 | PARTIAL (UI) | APA/MLA/Chicago select; unused |
| GEN-4 | MISSING | No RPC, no passage panel |
| GEN-5 | MISSING | Single fake 2s timeout |
| GEN-6 | MISSING | No generation |
| GEN-7 | MISSING | Examples stored, never used for style-only prompting |
| GEN-8 | MISSING | No outline button |
| GEN-9 | MISSING | No insert into `user_papers` from dashboard |
| GEN-10 | MISSING | `paper_references` unused by app code |

```56:68:src/pages/DashboardPage.tsx
  const handleGenerate = async () => {
      // TODO: Implement paper generation logic
      await new Promise(resolve => setTimeout(resolve, 2000))
      alert('Paper generation feature will be implemented in the next phase')
```

#### Quality

| ID | Status | Evidence |
|---|---|---|
| QUAL-1 | MISSING | No attribution model |
| QUAL-2 | MISSING | No `run_checks` |
| QUAL-3 | MISSING | |
| QUAL-4 | MISSING | Preview placeholder only |
| QUAL-5 | WRONG-BY-DESIGN in old spec | `.docs/legacy` tech doc still says cosine > 0.7 = accuracy. Do not implement that |

#### Library

| ID | Status | Evidence |
|---|---|---|
| LIB-1 | PARTIAL | Table UI; empty unless rows exist |
| LIB-2 | PARTIAL | Groups by title in memory |
| LIB-3 | PARTIAL | View works if content exists; regenerate alerts; delete hits DB |
| LIB-4 | MISSING | Export button no handler |
| LIB-5 | MISSING | `referenceCount: 0` comment TODO |

#### NFR

| ID | Status | Evidence |
|---|---|---|
| NFR-1 | PARTIAL | Table RLS yes; storage policies are bucket-wide for any authenticated user |
| NFR-2 | DONE | Object key `{user_id}/{file_id}` from JWT + file id on upload, delete, and ingest. Client `storagePath` is not used. Storage RLS still bucket-wide (NFR-1) |
| NFR-3 | DONE here | gitignore `.docs/*.pdf`; current history has no PDF blobs |
| NFR-4 | UNKNOWN | Live ingest E2E unmeasured while Storage is down |
| NFR-5 | MISSING | |
| NFR-6 | PARTIAL | Login has labels/aria; upload zone is keyboard-activatable |
| NFR-7 | PARTIAL | Unit tests in `src/lib/*.test.ts`. Integration (`npm run test:integration`) covers auth confirm/reset, Grok RPCs, metadata CHECKs and caps, RLS on references/examples/vectors/profile/papers. No Storage/ingest E2E or generate fixture |

### 4. Code vs old documentation

| Old claim (`.docs` / README features list) | Reality |
|---|---|
| React via cdn.jsdelivr.net | Vite SPA |
| Generation &lt; 5 min | No generation |
| Vectors deleted after 24h | Would destroy the corpus; not implemented (good) |
| Grok key on `user_profile` (plaintext) | Encrypted `user_grok_keys`; SPA sees last4 only |
| Storage `references/{user_id}/{file_id}` | As-built object key `{user_id}/{file_id}`; storage policies still bucket-wide |
| Quality checks, Word export, outline | Unbuilt |
| 90%+ check pass rate | Not a metric |

### 5. RAG design gaps (even after wiring Grok)

These are not “missing files.” They are product defects if you implement the old tech doc as written.

1. **Character chunking** mixes IMRaD sections and reference lists. Need layout-aware parse + section chunks.
2. **MiniLM-L6-v2** is weak for scientific text. Store `embedding_model` on rows so you can migrate.
3. **Top-k 10–20 for a whole paper** cannot ground Methods and Results. Retrieve per section.
4. **Regex `(Author, Year)`** is not citation correctness.
5. **Example papers in the same retriever** will be cited as evidence.

### 6. Dead code and duplication

- `src/pages/LoginPage.tsx` vs `src/components/Login.tsx` (router uses the latter)
- `src/pages/ProfilePage.tsx` vs `src/components/Profile.tsx`
- `src/edge-functions/` empty; real function is `supabase/functions/upload_processor`

### 7. Recommended build order

Matches engineering, not README order.

| Phase | Work | Unlocks |
|---|---|---|
| 0 | Keep PII out of git; README that matches reality. Auth (confirm + reset) is shipped. | Trust |
| 1 | Storage path `{user_id}/{file_id}` is shipped (NFR-2). Remaining: Storage up + fixture ingest E2E | Corpus |
| 2 | `match_reference_chunks` + dashboard “passages for this prompt” | Retrieval you can debug |
| 3 | Section-wise `generate_paper` with citation allow-list | Drafts that are not fiction |
| 4 | Attribution flags + library save/export | MVP cut line |
| 5 | Outline, extra styles, tighter storage RLS, eval harness | After MVP |

Do not start Word export or cosine “accuracy” before phase 3.

### 8. Local running snapshot (not a PRD gap)

Works today if Docker + `supabase start` (Homebrew CLI, not `npx`) + `.env` + Vite `:5173`:

- Sign up (any email); confirm via Mailpit/Inbucket at `:54324`; then the dashboard opens
- Password reset via the same inbox
- Dashboard form
- `npm test` (48 unit tests, no Docker)
- `npm run test:integration` (19 Auth/REST/RLS tests; Storage may be down)
- Upload to Storage only if `supabase_storage_arpw` is up
- Library empty state

Does not work: generate, outline, export, retrieval. Live ingest E2E fails while Storage is down (code path is hash-384, MiniLM TARGET). Unconfirmed users cannot reach `/dashboard`.

## References

- `.docs/PRODUCT_REQUIREMENTS.md` — requirement IDs
- `.docs/TECHNICAL_SPECIFICATION.md` — architecture
- `src/pages/DashboardPage.tsx`
- `src/components/UploadZone.tsx`
- `src/hooks/useAuth.tsx`, `src/App.tsx`
- `supabase/functions/upload_processor/index.ts`
- `supabase/migrations/20260906133100_init.sql`
- `src/lib/*.test.ts`, `src/integration/*.integration.test.ts`
- `../README.md` — tests how-to and reference
- `.docs/legacy/` — superseded drafts
