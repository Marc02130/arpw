# GENERATION_SLICES

## Overview

Tracker for the first generate cut. Status lives here. Intent is `.docs/PRODUCT_REQUIREMENTS.md`. As-built vs TARGET is `.docs/TECHNICAL_SPECIFICATION.md`. Do not treat README as the plan.

Locked product calls (2026-09-07):

- Server owns **paper type × section** prompt templates. Users do not edit them in this cut.
- The dashboard **Research prompt** is the only user-written generation text (topic, question, constraints).
- Each **reference** has `source_role`: `literature` (published work you cite) or `primary` (the author’s original research on this paper’s topic). Upload tab shows two sections writing the same `"references"` table and cap. Example papers stay style-only (GEN-7).
- QUAL, outline (GEN-8), Word export, MiniLM, and a per-section prompt editor are **out of these slices**.
- Interrogation and pins are a **follow-on cut**: `.docs/INTERROGATION_SLICES.md`. Do not import Ragged chats as references.

## Content

### Status

| Slice | Name | Status | Unlocks |
|---|---|---|---|
| 1 | `source_role` on references | **DONE** | Role-filtered retrieval |
| 2 | Frozen type × section templates | **DONE** | Generate without a user system prompt |
| 3 | Per-section retrieval + passages | **DONE** | GEN-4; NFR-7 retrieval hit |
| 4 | Grok section loop + citation allow-list | **DONE** | GEN-5/6; NFR-7 refuse unknown ids |
| 5 | Save `user_papers` + `paper_references` | **DONE** | GEN-9/10; library has rows |

Status values: **NEXT**, **IN PROGRESS**, **DONE**, **NOT STARTED**, **BLOCKED**.

### Slice 1 — `source_role` on references

**Done when:** every `"references"` row has `source_role` `literature` or `primary` (default `literature`); the dashboard list shows it and the user can change it; unit + REST tests cover the CHECK and RLS update of own rows only.

**Shipped:** `supabase/migrations/20260907160000_reference_source_role.sql`, `src/lib/sourceRole.ts`, `DocumentList.tsx` Role select (references only).

**Not in this slice:** retrieval, Grok, a third drop zone, tagging example papers.

**Likely files:** migration on `"references"`; `DocumentList.tsx`; maybe `src/types.ts`. Tests: `src/lib` helper if any; `src/integration/documents.integration.test.ts` / `rls.integration.test.ts`.

### Slice 2 — Frozen prompt templates

**Done when:** a TypeScript module maps `PaperType` × section name → retrieval query suffix + generation instructions; unit tests lock the matrix (Empirical Methods ≠ Literature Review Introduction); the SPA cannot send a system prompt.

**Not in this slice:** calling Grok; user-editable templates.

**Likely files:** `src/lib/generationTemplates.ts` (name can change) + `*.test.ts`. Edge/worker imports the same module or a copy under `supabase/functions/` if the generate function cannot import `src/`.

**Shipped:** `src/lib/generationTemplates.ts` — `getSectionTemplate` / `buildRetrievalQuery` / `buildGenerationPrompt` (research prompt only; no system-prompt argument). Dashboard section checkboxes use `PAPER_SECTIONS`.

### Slice 3 — Per-section retrieval + passages

**Done when:** `match_reference_chunks` (or equivalent) filters `auth.uid()`, optional `source_role`, k per section; dashboard shows passages for the current prompt/section; NFR-7 fixture: query containing `nfr7probe` hits the fixture chunk.

**Role filter (TARGET):**

| Section | Prefer |
|---|---|
| Abstract, Introduction, Literature Review | `literature` |
| Methods, Results | `primary` first; literature only if primary is empty |
| Discussion, Conclusion | both |
| References | no retrieval (generated from cited ids) |
| Literature Review as **paper type** | `literature` only; ignore `primary` |

Hash-384 is acceptable. MiniLM still TARGET.

**Not in this slice:** writing `user_papers`; QUAL flags.

**Shipped:** `match_reference_chunks` RPC; `src/lib/retrievePassages.ts` (primary then literature); Prompt tab **Show passages**. NFR-7 hit is the integration test with `nfr7probe`.

### Slice 4 — Grok section loop + allow-list

**Done when:** generate runs selected sections in order; each call gets templates + research prompt + retrieved `source_id`s; output citations not in that set are dropped; missing Grok key is a clear error; NFR-7: a fixture generate refuses an unknown citation id.

**Shipped:** Edge `generate_paper` (JWT + `read_grok_api_key`, per-section retrieve, Grok `chat/completions`, strip unknown `[S#]`). SPA `PaperGenerationPage` invokes it; does not send source ids or a system prompt. Unit tests: `citations.test.ts`, `generatePaper.test.ts`, `grokComplete.test.ts`. Live Grok E2E skips if the function is down; missing-key is covered in `generate.integration.test.ts`.

**Not in this slice:** outline mode; user-edited system prompts; QUAL-1 sentence mapping (follow-on); writing `user_papers.content` / `paper_references` (slice 5).

Worker reads the key via `read_grok_api_key` (service_role). SPA never sees the key.

### Slice 5 — Save draft

**Done when:** a successful generate inserts `user_papers` (title, content, sections, type, citation style, format, version, status) and `paper_references` for cited `file_id`s; library lists the row; GEN-9/10.

**Shipped:** `saveGeneratedDraft` updates the dashboard draft (`content`, sections, type, style, format, `status=completed`) and replaces `paper_references` with cited `file_id`s the user owns. `generate_paper` saves after Grok; it does not trust SPA-supplied source ids. Library lists the row and shows the source count. Unit + `papers.integration.test.ts`.

**Not in this slice:** export, regenerate, QUAL preview polish.

### Out of these slices

- GEN-8 outline
- QUAL-1–4 (after a real draft exists)
- LIB-4 export
- Extra-notes field (append-only; not a template editor)
- MiniLM / hosted embeddings
- Mixing example vectors into evidence

### How to use this file

After a slice lands, set its Status to **DONE** and point at the commit or files. Start the next **NEXT** slice from `main`. Do not start slice 4 before 3 (allow-list needs retrieval). Slice 2 may overlap 3 in a follow-up if needed; do not skip 1.

## References

- `.docs/PRODUCT_REQUIREMENTS.md` — GEN-1–10, DOCS-8
- `.docs/TECHNICAL_SPECIFICATION.md` — §4 `source_role`, §7 generate pipeline
- `.docs/GAP_ANALYSIS.md` — remaining GEN/NFR-7
- `src/pages/PaperGenerationPage.tsx` — Prompt tab generate handler
- `src/lib/nfr7Fixture.ts` — probe token `nfr7probe`
