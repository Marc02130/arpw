---
name: uat-literature-review
description: >
  Run the ARPW literature-review UAT and dogfood generate on the local corpus
  in UAT/papers/. Use when asked to "run UAT", "dogfood", "literature review
  UAT", "Grok Bot UAT", or "/uat-literature-review".
---

# Literature-review UAT

Follow `UAT/README.md` exactly. That file is the source of steps, pass/fail, the research prompt, runner flags, and troubleshooting.

## Before you start

1. Working tree should be on `main` (`git log -1 --oneline`).
2. Local Supabase + Vite. Do not use hosted project `uqcjcnnpqukxpwumugsp`.
3. `UAT/papers/` must contain the 20 PDFs. They are gitignored. If the folder is empty, **BLOCKED** — ask the operator to restore the corpus.
4. Skip the `.html` file in that folder.
5. Do not start a full generate run unless the user asked to run UAT.

## How to run

Prefer the Playwright runner:

```bash
node UAT/run-literature-review.mjs
# after a fixture or functions fix, if steps 1–7 already passed:
node UAT/run-literature-review.mjs --resume
```

Manual path: drive `http://127.0.0.1:5173` as a throwaway user (`uat-litrev-<date>@example.com`). Confirm via Mailpit `http://127.0.0.1:54324`. Do not type a real password into chat logs.

`UAT/.uat-grok-key` and `GROK_API_KEY` must contain a value that starts with `xai-`. Never paste the secret into chat, reports, or git. If a saved report failed on HTTP 500 / last4 `.env`, replace the fixture and `--resume` — do not re-upload the 20 PDFs.

Wait for “Working on …” before Query sources. A disabled Query sources after the paper has loaded, while `research_prompt` is saved, is FAIL (QA-2026-09-09-1).

## Output

Write a short report under `UAT/reports/` using the template in `UAT/README.md`. Do not commit PDFs, `.html` dumps, `.uat-grok-key`, exported drafts, or long quoted draft text.
