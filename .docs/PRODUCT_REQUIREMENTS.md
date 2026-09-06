# PRODUCT_REQUIREMENTS

## Overview

Product requirements for AI Research Paper Writer (ARPW), a web app that helps a researcher draft a paper from their own uploaded sources. This document states the intended MVP. It is not a status report. For what the code actually does today, read `documents/GAP_ANALYSIS.md`.

- Product: ARPW
- Audience: individual academic users (researchers, PIs, graduate students)
- Platform: web (desktop first)
- Version of this PRD: 1.1
- Date: 2026-09-06
- Status: current product intent for `feat/get-running`

ARPW is a **grounded drafting assistant**. It retrieves passages from the user’s corpus, generates section drafts with citations that map to those passages, and requires human review before anything looks like a submission. It is not a paper mill and it must not emit citations that are not in the retrieved set.

## Content

### 1. Problem

Writing a literature-backed draft from a personal PDF pile is slow. Generic chat models invent citations. Researchers need a private corpus, retrieval they can inspect, and a draft they can edit.

### 2. Goals

**User goals**

- Upload their own reference PDFs (and a few style examples).
- Ask for a paper on a topic, pick sections and paper type, get a draft grounded in those files.
- See which source passage supports each claim.
- Keep versions, export Markdown or Word, review before use.

**Product goals**

- Time-to-first-draft measured in minutes after the corpus is indexed, not hours of blank-page writing.
- Every generated citation traces to an uploaded file and chunk.
- Outputs carry a visible disclaimer: AI-generated draft, requires human review.

**Non-goals (MVP)**

- Multi-author collaboration or shared libraries.
- Mobile-first layout.
- Journal submission, plagiarism scanning, or publisher templates.
- Generating a full paper from 10–20 random chunks with no section-wise retrieval.

### 3. Users

Primary: a single researcher with a folder of PDFs and an xAI Grok API key.

Assumptions: they will review the draft; they own the rights to upload the files; they use a laptop browser.

### 4. Functional requirements

Each item has an ID for the gap analysis.

#### AUTH

| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | Email/password sign up and sign in via Supabase Auth. | P0 |
| AUTH-2 | Session persist and restore; sign out. | P0 |
| AUTH-3 | Create `user_profile` on first signup (`user_id` = `auth.uid()`). | P0 |
| AUTH-4 | Profile page: edit full name. | P1 |
| AUTH-5 | Store Grok API key server-side, not as plaintext readable by the SPA. | P0 |
| AUTH-6 | Invalid credentials show a clear error. | P0 |

#### DOCS

| ID | Requirement | Priority |
|---|---|---|
| DOCS-1 | Upload references: PDF, DOCX, TXT; max 10 MB each; cap 500 files per user. | P0 |
| DOCS-2 | Upload style examples: same types; cap 10 files. | P1 |
| DOCS-3 | Drag-and-drop and file picker; progress per file. | P1 |
| DOCS-4 | List uploaded files (name, size, date) and delete (storage + metadata + vectors). | P0 |
| DOCS-5 | Parse text, chunk with section/page metadata, embed, store in `pgvector`. | P0 |
| DOCS-6 | Reject unsupported types and oversize files before upload. | P0 |
| DOCS-7 | Enforce the 500 / 10 caps against existing rows, not only the current batch. | P1 |

#### GEN

| ID | Requirement | Priority |
|---|---|---|
| GEN-1 | Prompt textarea; section checkboxes (Abstract through References). | P0 |
| GEN-2 | Paper type: Empirical Study, Literature Review, Theoretical Paper, Case Study. | P0 |
| GEN-3 | Citation style: APA for MVP (MLA/Chicago later). | P1 |
| GEN-4 | Retrieve relevant reference chunks (hybrid search + rerank later); show sources in the UI. | P0 |
| GEN-5 | Generate **section by section**, each section with its own retrieval. | P0 |
| GEN-6 | Citations only from retrieved `source_id`s; drop invented citations. | P0 |
| GEN-7 | Example papers constrain tone/structure only; they are not evidence. | P1 |
| GEN-8 | Outline mode: generate an editable outline, then full draft. | P2 |
| GEN-9 | Save draft to `user_papers` with config, version, status. | P0 |
| GEN-10 | Link cited files in `paper_references`. | P0 |

#### QUAL

| ID | Requirement | Priority |
|---|---|---|
| QUAL-1 | Attribution: each generated sentence maps to chunk id + quote span, or is flagged uncited. | P0 |
| QUAL-2 | Citation check: citations exist in retrieved set and `paper_references`. | P0 |
| QUAL-3 | Format check: required sections present. | P2 |
| QUAL-4 | Preview with inline warnings and footer disclaimer. | P0 |
| QUAL-5 | Do not treat cosine > 0.7 as “factual accuracy.” | P0 (constraint) |

#### LIB

| ID | Requirement | Priority |
|---|---|---|
| LIB-1 | Library table: title, type, status, date, version. | P0 |
| LIB-2 | Version history grouped by title; increment version on regenerate. | P1 |
| LIB-3 | View, delete (confirm), regenerate. | P0 |
| LIB-4 | Export Markdown and Word with disclaimer. | P1 |
| LIB-5 | Actual reference count per paper, not a placeholder. | P2 |

#### NFR

| ID | Requirement | Priority |
|---|---|---|
| NFR-1 | RLS: a user only reads/writes their rows. | P0 |
| NFR-2 | Storage paths derived from `auth.uid()`, never trusted from the client. | P0 |
| NFR-3 | No PII fixtures (I-9, certificates, scans) in git. | P0 |
| NFR-4 | Indexing: first PDF produces visible chunks in under 2 minutes on a typical laptop/local stack. | P1 |
| NFR-5 | Generation: one section in under 2 minutes after retrieval. | P1 |
| NFR-6 | Keyboard-reachable primary flows (login, upload, generate). | P2 |
| NFR-7 | Tests: ingest of a fixture PDF; retrieval hit on a known query; generation refuses unknown citation ids. | P0 |

### 5. UX flow

1. Sign up / sign in.
2. Dashboard: upload references (and optional examples).
3. Wait until files show as processed (not only “uploaded”).
4. Enter prompt, pick sections and paper type.
5. Optional: generate outline, edit, confirm.
6. Generate draft section by section; inspect retrieved passages.
7. Preview with flags; light edits.
8. Save to library; export.

Empty states: no files, no papers, failed parse, missing API key.

### 6. Success metrics (after generation ships)

Measure these; do not invent pass rates.

- Retrieval: recall@k on a 20-question holdout over a known corpus.
- Citation precision: share of emitted citations that exist in retrieved chunks.
- Unsupported-claim rate: share of sentences with no mapped span.
- Time: upload-to-indexed; prompt-to-first-section.

### 7. Risks

| Risk | Mitigation |
|---|---|
| Hallucinated citations | Hard allow-list of retrieved source ids; refuse the rest. |
| Naive whole-paper generation | Section-wise retrieval and generation. |
| Academic misconduct if sold as “write my paper” | Product copy: drafting assistant; disclaimer on every export. |
| API keys in the browser | Server-only secret storage. |
| PII in the repo | `.docs/*.pdf` gitignored; never commit identity documents. |

### 8. MVP cut line

**Must ship for “MVP”:** AUTH-1–3, AUTH-5–6, DOCS-1, DOCS-4–6, GEN-1–2, GEN-4–6, GEN-9–10, QUAL-1–2, QUAL-4, LIB-1, LIB-3, NFR-1–3, NFR-7.

Everything else can follow without pretending it is done.

## References

- `documents/TECHNICAL_SPECIFICATION.md` — as-built and target architecture
- `documents/GAP_ANALYSIS.md` — PRD vs code
- `supabase/migrations/20260906133100_init.sql` — current schema
- `.docs/AI_Research_Paper_Writer_User_Stories.markdown` — original stories (stale; superseded where they conflict)
