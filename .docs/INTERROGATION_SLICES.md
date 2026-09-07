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
| 1 | Pin schema + list/unpin | **NEXT** | Structured “include this” |
| 2 | Interrogate tab (grounded Q&A) | NOT STARTED | Researcher inspects the corpus |
| 3 | Pin from interrogation | NOT STARTED | Pins from a real question |
| 4 | Generate uses pins first | NOT STARTED | Draft follows marked passages |
| 5 | Persist interrogation chat as notes | NOT STARTED | Continue the conversation |

Status values: **NEXT**, **IN PROGRESS**, **DONE**, **NOT STARTED**, **BLOCKED**.

### Slice 1 — Pin schema + list/unpin

**Done when:** a `pinned_passages` (name can change) row stores `user_id`, `paper_id`, `file_id`, `vector_id`, optional `target_section`, timestamps; RLS is own rows only; the Prompt tab can list and unpin pins for the current paper; unit + REST tests cover CHECK/RLS (cannot pin another user’s chunk).

**Not in this slice:** chat UI; generate reading pins; pinning from interrogation.

**Likely files:** migration; `src/lib/pins.ts` + tests; Prompt tab pin list. Integration: `src/integration/` RLS + own-row insert.

### Slice 2 — Interrogate tab

**Done when:** Paper generation has an **Interrogate** tab (`/generate/interrogate?paper=…`); the user asks a question; the worker retrieves from `literature` and/or `primary` (user filter); Grok answers using only retrieved `[S#]` ids; unknown ids are stripped; missing Grok key is the same Profile error as generate. Passages for the answer are visible.

**Not in this slice:** pins; saving the thread; examples in the interrogate retriever (examples stay style-only on generate).

**Likely files:** Edge `interrogate_corpus` (or extend `generate_paper`); `PaperGenerationPage` tab. Reuse `match_reference_chunks` + `stripUnknownCitations`.

### Slice 3 — Pin from interrogation

**Done when:** each shown passage has Pin; pin stores `vector_id` / `file_id` and optional target section (Methods, Results, …); Prompt tab shows those pins; unpin works.

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

**Not in this slice:** QUAL sentence mapping changes beyond using the larger allow-list.

### Slice 5 — Persist interrogation chat as notes

**Done when:** Q&A for the paper is stored (user/assistant turns); reload shows the thread; those rows are **not** in `match_reference_chunks` and **not** numbered as `[S#]`.

**Not in this slice:** exporting the thread as a PDF; Ragged import.

### Out of these slices

- Merging or wrapping Ragged
- Importing a chat transcript as a reference file
- MiniLM / hosted embeddings
- Outline (GEN-8), Word export (LIB-4)
- User-editable system prompts

### How to use this file

After a slice lands, set its Status to **DONE** and point at the files. Start the next **NEXT** slice from `main`. Do not start slice 4 before 1 (generate needs pins). Slice 2 may land before 3; do not skip 1.

## References

- `.docs/PRODUCT_REQUIREMENTS.md` — INT-1–3, PIN-1–2
- `.docs/TECHNICAL_SPECIFICATION.md` — interrogation TARGET
- `.docs/GAP_ANALYSIS.md` — remaining INT/PIN
- `.docs/GENERATION_SLICES.md` — generate cut (shipped)
- `src/pages/PaperGenerationPage.tsx` — Prompt / Upload; Interrogate is TARGET
