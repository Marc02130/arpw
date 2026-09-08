# INTERROGATION_SLICES

## Overview

Tracker for corpus interrogation and pins. Status lives here. Intent is `.docs/PRODUCT_REQUIREMENTS.md`. As-built vs TARGET is `.docs/TECHNICAL_SPECIFICATION.md`. Do not treat README as the plan.

This is how the researcher **figures out what the paper should say** before (and during) generate. It is not a second product and it is not Ragged.

Locked product calls (2026-09-07):

- Interrogation lives **in ARPW**, on the same files and vectors as generate. Do not merge the Ragged repo. Do not import Ragged chats as literature or as citable primary.
- **Pins** are structured: `vector_id` + `file_id` (+ optional target section). They are evidence. Generate retrieves **pinned chunks first**, then the usual role-filtered vector search.
- **Chat text is notes**, never `[S#]` evidence (same rule as example papers). A saved interrogation thread must not enter the citation allow-list.
- Upload roles stay: `literature` (published, citable), `primary` (this study’s original research), examples (style only).
- Interrogate may filter by `source_role`. Worker uses `read_grok_api_key`; SPA never sees the key. Same citation allow-list as generate (retrieved + pinned ids only).
- Ragged can stay a separate lab for general “chat with PDFs.” The paper pipeline must not depend on it.

## Content

### Status

| Slice | Name | Status | Unlocks |
|---|---|---|---|
| 1 | Pin schema + list/unpin | **DONE** | Structured “include this” |
| 2 | Interrogate tab (grounded Q&A) | **DONE** | Researcher inspects the corpus |
| 3 | Pin from interrogation | **DONE** | Pins from a real question |
| 4 | Generate uses pins first | **DONE** | Draft follows marked passages |
| 5 | Persist interrogation chat as notes | **DONE** | Continue the conversation |

Status values: **NEXT**, **IN PROGRESS**, **DONE**, **NOT STARTED**, **BLOCKED**.

### Slice 1 — Pin schema + list/unpin

**Done when:** a `pinned_passages` (name can change) row stores `user_id`, `paper_id`, `file_id`, `vector_id`, optional `target_section`, timestamps; RLS is own rows only; the Prompt tab can list and unpin pins for the current paper; unit + REST tests cover CHECK/RLS (cannot pin another user’s chunk).

**Shipped:** `supabase/migrations/20260907210000_pinned_passages.sql`; `src/lib/pins.ts` + `pins.test.ts`; Prompt tab list/unpin and Pin on Query sources (examples rejected by FK); `src/integration/pins.integration.test.ts`.

**Not in this slice:** chat UI; generate reading pins; pinning from interrogation.

### Slice 2 — Interrogate tab

**Done when:** Paper generation has an **Interrogate** tab (`/generate/interrogate?paper=…`); the user asks a question; the worker retrieves from `literature` and/or `primary` (user filter); Grok answers using only retrieved `[S#]` ids; unknown ids are stripped; missing Grok key is the same Profile error as generate. Passages for the answer are visible.

**Shipped:** Edge `interrogate_corpus`; `src/lib/interrogateCorpus.ts` + tests; `src/lib/interrogateClient.ts`; `src/components/InterrogatePanel.tsx`; tab on `PaperGenerationPage`; `src/integration/interrogate.integration.test.ts`. Reuses `match_reference_chunks` + `stripUnknownCitations`. No examples. Thread persist is slice 5.

**Not in this slice:** pins; saving the thread; examples in the interrogate retriever (examples stay style-only on generate).

### Slice 3 — Pin from interrogation

**Done when:** each shown passage has Pin; pin stores `vector_id` / `file_id` and optional target section (Methods, Results, …); Prompt tab shows those pins; unpin works.

**Shipped:** `InterrogatePanel` Pin/Unpin + target-section select (`Any section` or a paper section, never `Interrogate`); shared `handlePinPassage` on `PaperGenerationPage`; Prompt list refreshes from the same `pins` state. `parsePinTargetSection('Interrogate')` is rejected.

**Not in this slice:** generate consuming pins.

### Slice 4 — Generate uses pins first

**Done when:** for each selected section, retrieval is: (1) pins whose `target_section` is that section or is null, (2) then existing `source_role` vector search. Allow-list is the union. Pinned example-paper chunks are rejected (examples are never evidence). Chat rows are not retrieved.

**Retrieval role (update):**

| Section | Prefer |
|---|---|
| Abstract, Introduction | `literature`; include `primary` if pins or primary chunks exist for this study’s claims |
| Literature Review | `literature` only |
| Methods, Results | `primary` first, then literature |
| Discussion, Conclusion | both |
| References | no retrieval (from cited ids) |
| Literature Review as **paper type** | `literature` only; ignore `primary` |

**Shipped:** `filterPinsForSection` + `mergePinnedFirst` + `loadEvidencePins` in `retrievePassages.ts`; `generate_paper` and Query sources pass `paperId`/`pins`. Example roles dropped. Literature Review ignores primary pins. Abstract/Introduction unions primary for non-review papers. Integration: pinned literature chunk leads Methods retrieval.

**Not in this slice:** QUAL sentence mapping changes beyond using the larger allow-list.

### Slice 5 — Persist interrogation chat as notes

**Done when:** Q&A for the paper is stored (user/assistant turns); reload shows the thread; those rows are **not** in `match_reference_chunks` and **not** numbered as `[S#]`.

**Shipped:** `supabase/migrations/20260907220000_interrogation_turns.sql`; `src/lib/interrogationNotes.ts` + tests; Interrogate tab loads/saves the thread; assistant `passages` jsonb is display/pin metadata only. Integration: own-row RLS; distinctive chat text is not returned by `match_reference_chunks`.

**Not in this slice:** exporting the thread as a PDF; Ragged import.

### Out of these slices

- Merging or wrapping Ragged
- Importing a chat transcript as a reference file
- Hybrid search / rerank
- Outline (GEN-8), Word export (LIB-4)
- User-editable system prompts

### Tests (written and run 2026-09-07)

Unit (`npm test`, no network): **20 files, 92 passed** at slice 5 land, including `pins.test.ts`, `interrogateCorpus.test.ts`, `retrievePassages.test.ts` (pin-first), `interrogationNotes.test.ts`. QUAL-2 adds `citationCheck.test.ts` on a later branch.

Integration (`npm run test:integration`, local API): **12 files, 36 passed** with Storage and Edge functions up, including:

| File | Coverage |
|---|---|
| `pins.integration.test.ts` | Own pin/list/unpin; RLS; cannot pin another user’s chunk or examples; invalid target CHECK |
| `interrogate.integration.test.ts` | 401 anonymous; missing Grok key (skips if function down) |
| `retrieval.integration.test.ts` | Role filter; pinned literature chunk leads Methods retrieval |
| `interrogationNotes.integration.test.ts` | Save/reload thread; other user hidden; chat text not in `match_reference_chunks` |

**Not covered:** live Grok completion (no xAI call in either suite). Missing-key paths are covered. Generate with a real key against pinned passages is manual.

### How to use this file

Slices 1–5 are **DONE**. Remaining product work is outside this tracker (outline, hybrid/rerank).

## References

- `.docs/PRODUCT_REQUIREMENTS.md` — INT-1–3, PIN-1–2
- `.docs/TECHNICAL_SPECIFICATION.md` — interrogation as-built
- `.docs/GAP_ANALYSIS.md` — remaining QUAL/export
- `.docs/GENERATION_SLICES.md` — generate cut (shipped)
- `src/pages/PaperGenerationPage.tsx` — Prompt / Upload / Interrogate
