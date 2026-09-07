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
| [INTERROGATION_SLICES.md](./INTERROGATION_SLICES.md) | Interrogate + pins | Slice tracker: pin schema, interrogate tab, pin from Q&A, generate uses pins, chat as notes |
| [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) | Planning | PRD vs code; build order |
| [legacy/](./legacy/) | Superseded | Drafts; ignore where they conflict |

**Which file to open**

- First run, confirm email, upload, Grok key, tests: `../README.md`
- About to write code: [GAP_ANALYSIS.md](./GAP_ANALYSIS.md)
- About to implement generate: [GENERATION_SLICES.md](./GENERATION_SLICES.md)
- About to implement interrogate/pins: [INTERROGATION_SLICES.md](./INTERROGATION_SLICES.md) (slices 1–5 shipped)
- Remaining MVP: export (LIB-4), outline (GEN-8); QUAL-1–5 shipped
- Schema, RPCs, embeddings, test commands: [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md)
- What “MVP” still means: [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md)

## References

- Local setup and tests: `../README.md`
- Schema: `../supabase/migrations/` (init through grok key, caps, vectors, storage RLS, source_role, match RPCs, pins, interrogation notes)
- Unit tests: `../src/lib/*.test.ts`
- Integration tests: `../src/integration/*.integration.test.ts`
