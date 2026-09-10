# OUTLINE_SLICES

## Overview

Tracker for GEN-8. Intent is `.docs/PRODUCT_REQUIREMENTS.md`. Outline is an optional editable skeleton on the paper. Frozen type×section templates stay frozen. The research prompt stays the topic/question.

Locked product calls (2026-09-10):

- Stored as `user_papers.outline` (text). Persist/hydrate like `research_prompt`. Generate save does not write outline or `paper_type`.
- Prompt tab card between research prompt and sections. Not a fourth tab.
- Optional: empty outline → current generate path.
- Generate outline is grounded (retrieve + `[S#]` allow-list). Missing Grok key is the same Profile error as generate.
- Draft generate reads outline from the paper row, not the client body.

## Content

### Status

| Slice | Name | Status | Unlocks |
|---|---|---|---|
| 1 | Persist + Prompt card | **DONE** | Continue restores outline |
| 2 | `generate_outline` Edge | **DONE** | Grounded skeleton from corpus |
| 3 | Draft follows outline | **DONE** | Section prompts include outline bullets |

### Out of this cut

- Auto-toggling section checkboxes from headings
- Per-section prompt editor
- Outline as Query sources evidence
- UAT playbook step (add when dogfooding outline)

## References

- `.docs/PRODUCT_REQUIREMENTS.md` — GEN-8
- `.docs/GENERATION_SLICES.md` — frozen templates
- `src/pages/PaperGenerationPage.tsx` — Outline card
- `supabase/functions/generate_outline/index.ts`
