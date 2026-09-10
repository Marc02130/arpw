# DOCUMENTS

## Overview

Index of product and engineering specs for ARPW. These files are the source of intent and as-built status. The user-facing walkthrough is `../README.md` (tutorial, how-to, reference, explanation). Do not treat README feature rows as the PRD. Do not treat `legacy/` as status.

## Content

| File | Role | What it is |
|---|---|---|
| [../README.md](../README.md) | Tutorial / how-to / reference / explanation | First run, tasks, APIs, why (including [tests](../README.md#how-to-run-tests)) |
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Intent | Who it is for, requirement IDs, MVP cut line. Not a status report. |
| [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) | As-built + TARGET | Stack, schema, RPCs, ingest, tests, TARGET RAG |
| [GENERATION_SLICES.md](./GENERATION_SLICES.md) | Generate cut | Slice tracker: `source_role`, templates, retrieval, Grok, save (shipped) |
| [OUTLINE_SLICES.md](./OUTLINE_SLICES.md) | Outline (GEN-8) | Persist, generate outline, draft follows outline (shipped) |
| [INTERROGATION_SLICES.md](./INTERROGATION_SLICES.md) | Interrogate + pins | Slice tracker: pin schema, interrogate tab, pin from Q&A, generate uses pins, chat as notes |
| [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) | Planning | PRD vs code; build order |
| [../UAT/README.md](../UAT/README.md) | UAT / dogfood | Literature-review playbook: Playwright runner, `xai-` key fixture, Source citations, academic References, pin-from-thread, Continue. PDFs stay in `UAT/papers/` (gitignored) |
| [legacy/](./legacy/) | Superseded | Drafts; ignore where they conflict |

**Which file to open**

- First run, confirm email, upload, Grok key, tests: `../README.md`
- Literature-review UAT / Grok Bot dogfood: [../UAT/README.md](../UAT/README.md)
- About to write code: [GAP_ANALYSIS.md](./GAP_ANALYSIS.md)
- About to implement generate: [GENERATION_SLICES.md](./GENERATION_SLICES.md)
- About to implement interrogate/pins: [INTERROGATION_SLICES.md](./INTERROGATION_SLICES.md) (slices 1–5 shipped)
- About to implement outline: [OUTLINE_SLICES.md](./OUTLINE_SLICES.md) (slices 1–3 shipped)
- Remaining after generate: eval harness; QUAL-2 uncited prose is a quality note. Outline (GEN-8) shipped.
- Schema, RPCs, embeddings, test commands: [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md)
- What “MVP” still means: [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md)

## References

- Local setup and tests: `../README.md`
- Schema: `../supabase/migrations/` (init through grok key, caps, vectors, storage RLS, source_role, match RPCs, pins, interrogation notes, vector `page`, prefer_section, embedding_model filter, hybrid FTS/RRF)
- Unit tests: `../src/lib/*.test.ts`
- Integration tests: `../src/integration/*.integration.test.ts`
