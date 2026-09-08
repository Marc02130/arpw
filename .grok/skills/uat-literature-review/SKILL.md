---
name: uat-literature-review
description: >
  Run the ARPW literature-review UAT and dogfood generate on the local corpus
  in UAT/papers/. Use when asked to "run UAT", "dogfood", "literature review
  UAT", "Grok Bot UAT", or "/uat-literature-review".
---

# Literature-review UAT

Follow `UAT/README.md` exactly. That file is the source of steps, pass/fail, and the research prompt.

## Before you start

1. Working tree should be on `main` with the RAG ingest/retrieve work (`git log -1 --oneline`).
2. Local Supabase + Vite. Do not use hosted project `uqcjcnnpqukxpwumugsp`.
3. `UAT/papers/` must contain the 20 PDFs. They are gitignored. If the folder is empty, **BLOCKED** — ask the operator to restore the corpus.
4. Skip the `.html` file in that folder.

## How to run

Drive the app as a user at `http://127.0.0.1:5173` (browse skill / Grok browser). Do not type the operator’s real password into chat logs; use a throwaway UAT account (`uat-litreview-<date>@example.com`). Confirm email via Mailpit `http://127.0.0.1:54324`.

Upload files from the local path `UAT/papers/*.pdf` as **literature** on `/generate/upload`. Paper type **Literature Review**. Prompt and section list are in `UAT/README.md`.

If generate asks for a Grok key, stop and tell the operator to save one on Profile (you never paste secrets). Then resume from the Generate step.

Do not treat a filesystem path as the key. `UAT/.uat-grok-key` and `GROK_API_KEY` must contain a value that starts with `xai-`. If a saved report failed on HTTP 500 / last4 `.env`, replace the fixture and resume with `node UAT/run-literature-review.mjs --resume` — do not re-upload the 20 PDFs.

Pin from the Interrogate **answer thread** (do not reload first). Continue must restore **Literature Review** after “Working on …”; fail if the type is Empirical Study. Generate must not rewrite `paper_type`.

## Output

Write a short report under `UAT/reports/` using the template in `UAT/README.md`. Do not commit PDFs, `.html` dumps, or long quoted draft text. Commit the report only if it is a PASS/FAIL table with no paper excerpts.
