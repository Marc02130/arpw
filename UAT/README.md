# Literature-review UAT

Dogfood ARPW by drafting a **Literature Review** from the local corpus in `UAT/papers/`. Grok Bots and humans follow this playbook. The Playwright runner is `UAT/run-literature-review.mjs`.

This is not `npm test`. The unit suite never calls xAI. This UAT does: upload, index, retrieve, pin, interrogate, generate, preview, save, export. Local stack only. Do not point the app at hosted project `uqcjcnnpqukxpwumugsp`.

Do **not** commit files under `UAT/papers/` (copyrighted PDFs), `UAT/reports/` (drafts and screenshots), or `UAT/.uat-grok-key`. Skip the `.html` dump in the papers folder; it is not an accepted upload type.

### In this playbook

| Kind | Where |
|---|---|
| Tutorial | [Run the literature-review UAT](#tutorial-run-the-literature-review-uat) |
| How-to | [Bring the stack up](#how-to-bring-the-local-stack-up), [Grok key fixture](#how-to-set-the-grok-key-fixture), [Resume](#how-to-resume-a-failed-run), [Source citations](#how-to-inspect-source-citations), [Run by hand](#how-to-run-the-uat-by-hand) |
| Reference | [Corpus](#corpus), [Paper](#paper-to-start), [Steps 1–13](#reference-steps-113), [Runner](#reference-runner), [Reports](#reference-reports), [Fail the UAT](#fail-the-uat) |
| Explanation | [Why these gates exist](#why-these-gates-exist) |

Product walkthrough: [`../README.md`](../README.md). Specs: [`../.docs/README.md`](../.docs/README.md).

## Goal

Prove the grounded path on a real pile of papers. Fail if generate runs without a real `xai-` key, if a citation is not from the uploaded set, if indexing never shows chunks, if **References** is not an academic list, or if Continue restores a paper type other than Literature Review.

Uncited-sentence ⚠ marks in the draft body are QUAL-2. They do not fail this UAT. A bad **References** list does.

## Corpus

20 PDFs, all under 10 MB, role **literature**. Topic cluster: Alzheimer’s disease, gut–brain axis, omega-3, microbiome, inflammation, aging.

| File |
|---|
| `12035_2026_Article_5914.pdf` |
| `13024_2024_Article_720.pdf` |
| `13668_2024_Article_539.pdf` |
| `41467_2017_Article_40.pdf` |
| `aging-12-102930.pdf` |
| `ALZ-20-5771.pdf` |
| `awad303.pdf` |
| `CAR-15-1106.pdf` |
| `coip-38-252.pdf` |
| `ebc-69-6-EBC20253055.pdf` |
| `fcimb-10-00104.pdf` |
| `ijms-24-14686.pdf` |
| `ijms-25-08619.pdf` |
| `KGMI_16_2371950.pdf` |
| `nihms-1625793.pdf` |
| `nihms-1921046.pdf` |
| `nihms-2120193.pdf` |
| `nutrients-17-03053.pdf` |
| `OMCL2019-4730539.pdf` |
| `s41598-017-13601-y.pdf` |

Skip: `The Gut-Brain Axis in Alzheimer’s Disease and Omega-3. A Critical Overview of Clinical Trials - PMC.html`.

If `UAT/papers/` is empty or has fewer than 20 PDFs, the UAT is **BLOCKED**. Ask the operator to restore the corpus. Do not download replacements from the web for this playbook.

## Paper to start

- Title: `Gut-brain axis in Alzheimer’s disease: a literature review`
- Type: **Literature Review** (must ignore `primary` / original research)
- Sections: Abstract, Introduction, Literature Review, Discussion, Conclusion, References (leave Methods and Results off)
- Citation style: APA
- Output: Markdown
- Research prompt (paste exactly):

> Synthesize a literature review of the gut-brain axis in Alzheimer’s disease from the uploaded papers only. Cover microbiome, inflammation, omega-3 fatty acids, and clinical-trial evidence. Cite only retrieved [S#] ids. Do not invent studies, n, or outcomes.

## Tutorial: run the literature-review UAT

You will start the local stack, put a real xAI key in a gitignored fixture, and let the Playwright runner walk steps 1–13.

### What you'll need

- Docker Desktop running
- Homebrew Supabase CLI (`which supabase` is a binary, not `npx`)
- Node.js, `npm install` already done
- Vite on [http://127.0.0.1:5173](http://127.0.0.1:5173)
- The 20 PDFs in `UAT/papers/`
- A real xAI secret that starts with `xai-` (never a path to `.env`)
- Playwright Chromium (`npx playwright install chromium` once if the runner cannot launch a browser)

### Step 1: Bring the stack up

Follow [How to bring the local stack up](#how-to-bring-the-local-stack-up). You should see API `:54321`, Mailpit `:54324`, Vite `:5173`, and `functions serve` logging `lookup_citation` next to `generate_paper`.

### Step 2: Put the Grok key in the fixture

Follow [How to set the Grok key fixture](#how-to-set-the-grok-key-fixture). The runner fail-fasts if the value is missing, looks like a filesystem path, or does not start with `xai-`.

### Step 3: Run the runner

```bash
node UAT/run-literature-review.mjs
```

A new throwaway user is created (`uat-litrev-<timestamp>@example.com`), confirmed via Mailpit, and driven through the 13 steps. Watch `STEP n: PASS|FAIL|BLOCKED` on stdout. A full generate run takes many minutes (ingest of 20 PDFs plus Grok per section).

### What you built

A dated report under `UAT/reports/` (gitignored), screenshots on failure, and `UAT/reports/.uat-state.json` so you can [resume](#how-to-resume-a-failed-run) without re-uploading. Verdict is **PASS**, **FAIL**, or **BLOCKED**.

## How to bring the local stack up

Local stack, not the hosted project.

```bash
which supabase   # Homebrew CLI, not npx
docker info
supabase status  # API :54321, Studio :54323, Mailpit :54324
```

If Storage is down, this UAT is **BLOCKED**. Do not treat ingest as passable while Storage is down.

Apply local migrations through `20260907290000_reference_citation_text.sql` (also `grok_key_shape` and `reference_bibliographic`). `supabase db push --local` can miss history on this repo. If Studio or REST does not show `references.citation_text`, apply the SQL with `psql` against local Postgres `:54322`, insert the version into `supabase_migrations.schema_migrations`, then `NOTIFY pgrst, 'reload schema';`.

Serve Edge functions so ingest, generate, interrogate, and citation lookup use current code. The Docker network name is the local project’s network:

```bash
supabase functions serve --network-id supabase_network_arpw
```

You need all of: `upload_processor`, `embed_text`, `generate_paper`, `interrogate_corpus`, `lookup_citation`. Restart this process after pulling Edge changes. Catalog lookup (Crossref, PubMed, doi.org) needs that network id; without it, Library citation fields stay empty.

```bash
npm run dev      # http://127.0.0.1:5173  (strictPort)
```

Auth confirmations stay on. The UAT confirms via Mailpit like a real user. Do not set `enable_confirmations = false`. Integration tests confirm with the service role; this playbook does not.

## How to set the Grok key fixture

Generate, interrogate, and hosted embeddings need a Grok API key on Profile. Without a key, ingest still indexes as `hash-384`; generate must refuse with “Save a Grok API key on Profile before generating.”

The value must be a real xAI secret that starts with `xai-`. A filesystem path (for example `/Users/…/.env`) is not a key. Profile last4 of `.env` means the fixture was a path; that run is **FAIL**.

For the Playwright runner, put the secret in either:

```bash
export GROK_API_KEY='xai-…'          # session env, preferred
# or a gitignored file:
printf '%s' 'xai-…' > UAT/.uat-grok-key
```

Never commit `UAT/.uat-grok-key`. Never paste the key into chat, reports, or git. Profile must show last4 only.

If a saved report failed on HTTP 500 / last4 `.env`, replace the fixture, then [resume](#how-to-resume-a-failed-run). Do not re-upload the 20 PDFs.

## How to resume a failed run

The runner writes `UAT/reports/.uat-state.json` (email, paper id, per-step status). After you fix the fixture or restart functions:

```bash
node UAT/run-literature-review.mjs --resume
```

`--resume` logs in as the saved throwaway user (password is `const password` in `UAT/run-literature-review.mjs`), skips a fresh signup and re-upload when those steps already passed, and continues from interrogate / generate. It still re-saves the Grok key on Profile.

Needs step 1 email and step 3 `paper=` id in the saved state. If that file is missing, start a new run.

## How to inspect Source citations

After index, open `/library`. The **Source citations** heading lists every uploaded literature file, even if no paper has been generated yet.

Each row has a **Citation** textarea (`id="citation-<file_id>"`). Ingest should fill it from the file’s DOI or PMID (Crossref, then PubMed, then the doi.org APA cite). A filled value looks like a publisher/PubMed string (author, year, journal, `doi.org` or `PMID`), not the PDF filename.

Empty fields: paste the publisher or PubMed cite, or type a DOI/PMID and click **Look up from DOI/PMID**. Blur saves. Upload tab literature rows have the same field.

The generate **References** section uses these stored strings. It does not retrieve passages for that section and it does not invent citations from filenames.

## How to run the UAT by hand

Drive [http://127.0.0.1:5173](http://127.0.0.1:5173) as a user. Use a throwaway account (`uat-litrev-<date>@example.com` or similar). Do not type a real password into chat logs. Confirm email at [http://127.0.0.1:54324](http://127.0.0.1:54324).

Then follow [steps 1–13](#reference-steps-113). Same pass/fail as the runner.

If generate asks for a Grok key, stop and save one on Profile (never paste secrets into the report). Resume from Generate.

Pin from the Interrogate **answer thread**. Do not reload the tab first. After pin, Prompt must show **Pinned passages** (not “Loading pins…” and not “No pins yet”).

Continue must restore **Literature Review** after “Working on …”. Fail if the type is Empirical Study.

## Reference: steps 1–13

Record **PASS / FAIL / BLOCKED** per step. BLOCKED needs the exact error.

| # | Action | Pass if |
|---|---|---|
| 1 | Open `/login`, sign up, confirm email via Mailpit `:54324`, land on Dashboard | Confirmed session; unconfirmed cannot open `/dashboard` |
| 2 | Profile: save a Grok key | Last4 only; key never shown in full; value started with `xai-` |
| 3 | Dashboard: **Start paper** with the title and Literature Review | Redirect to `/generate?paper=…` |
| 4 | Upload tab: **Literature** only. Upload all 20 PDFs as literature. Do not use Original research. | Each file listed; none rejected for type/size. Each literature row has a **Citation** field |
| 5 | Wait until index status is not “Stored (not indexed)” (first PDF chunks visible in &lt; 2 min). Open **Library**: **Source citations** | At least one file shows a chunk count. Library lists uploaded files with a citation textarea. Files with a DOI should show a publisher/PubMed cite (not the filename). Empty fields: paste the cite or **Look up from DOI/PMID** |
| 6 | Prompt tab: paste the research prompt. **Query sources** | Passages appear with `literature` (not primary). Section labels and `p.N` may show |
| 7 | Pin 2–3 literature chunks to Literature Review or unscoped | Pinned list shows them first on the next Query sources |
| 8 | Interrogate: “What do these papers say about omega-3 and cognition?” Sources: literature | Answer uses only `[S#]` from retrieved passages; unknown ids absent. HTTP 2xx. A missing key must refuse before you re-save |
| 9 | Interrogate: pin one passage **from the answer thread** (do not reload the tab first) | Wait for Unpin on the thread. Prompt shows **Pinned passages**, not “No pins yet” while pins are loading |
| 10 | Generate Paper | Draft saved; headings for selected sections; **References** uses stored citation strings (author, journal, DOI), not PDF filenames; footer disclaimer. Wall clock is not instant |
| 11 | Spot-check citations | Every `[S#]` was in the queried/pinned set. No invented author-year. Literature Review did not pull original-research files (there are none). References is not “No retrieved sources” and does not dump `Citation:` boilerplate |
| 12 | Library: **Source citations** still listed. Paper listed completed. View preview (cited sources show the cite field). Export Markdown and Word | Files download; both include the human-review disclaimer |
| 13 | Continue from library | Wait for “Working on …”, then Prompt restores title, **Literature Review**, and the research prompt |

The runner also clears the Profile key between step 2 and step 8 and checks that Interrogate refuses without a key (`step 2b`). That is a QA extra, not a numbered playbook step. Re-save the fixture key before Ask.

## Reference: runner

```bash
node UAT/run-literature-review.mjs
node UAT/run-literature-review.mjs --resume
```

| Item | Value |
|---|---|
| App | `http://127.0.0.1:5173` |
| Mailpit | `http://127.0.0.1:54324` |
| Key | `GROK_API_KEY` or `UAT/.uat-grok-key` |
| Corpus | `UAT/papers/*.pdf` (expects 20) |
| State | `UAT/reports/.uat-state.json` |
| Screenshots | `UAT/reports/screenshots/stepN-fail.png` |
| Report file the runner overwrites | `UAT/reports/2026-09-07-literature-review.md` |
| Email | `uat-litrev-<timestamp>@example.com` |

Fail-fast on a bad key fixture: step 2 FAIL (or BLOCKED if missing), steps 8–13 BLOCKED, process exits before signup.

Step 8 requires a 2xx from `interrogate_corpus` **and** at least one `[S#]` in the UI. A 500 with empty body is FAIL, not a skip.

Step 9 stays on the Interrogate thread, clicks Pin, waits for Unpin, then opens Prompt and waits until **Pinned passages** is visible and **No pins yet** / **Loading pins** are gone.

Step 10 fails if References says “No retrieved sources”, lists `Something.pdf` as a numbered work, or dumps publisher `Citation:` boilerplate (`referencesLooksAcademic` in the runner).

Step 13 waits for “Working on …” and `#paper-type === 'Literature Review'` before reading the prompt. Generate save must not write `paper_type`.

## Reference: reports

Write `UAT/reports/<date>-literature-review.md`. The whole `UAT/reports/` tree is gitignored. Include:

- Operator (Grok Bot id or human)
- Git SHA (`git rev-parse --short HEAD`)
- Embedding model shown after ingest (`hash-384` vs `grok-embedding-small`)
- Files indexed / files failed
- Library citation fill count (publisher-like strings vs empty)
- Generate wall time for one section if noted
- Step table
- Screenshots or quoted UI errors (not long draft excerpts)
- Verdict: **PASS**, **FAIL**, or **BLOCKED**

Do not paste long draft excerpts that quote the PDFs into git. Do not commit a PASS/FAIL table that includes paper text. Do not commit exported `.md` / `.docx` from `UAT/reports/screenshots/`.

## Fail the UAT

- Generate succeeds with no Grok key
- The saved key was a filesystem path or did not start with `xai-`
- Draft cites `[S99]` or a file that was not uploaded
- Original-research upload was used for this literature-review paper
- Indexing never produces chunks (Storage/Edge down counts as **BLOCKED**, not a product fail)
- Export missing `AI-generated draft. Requires human review…`
- Continue shows a paper type other than **Literature Review** after “Working on …” (the generate save must not rewrite type)
- References says “No retrieved sources”, lists PDF filenames as if they were citations, dumps publisher “Citation:” boilerplate, or omits cited works while other sections used `[S#]`

Do not fail solely because the draft body has ⚠ uncited sentences. That is QUAL-2. Do fail if the References section is not an academic list of the cited uploads.

## Why these gates exist

**`xai-` key, not a path.** Profile used to accept any string ≥ 10 characters. A fixture that pointed at `.env` stored last4 `.env`, xAI returned 400, generate/interrogate returned 500, and an older runner treated a non-empty page as PASS. Client, RPC (`set_grok_api_key`), and the runner now reject paths and require `xai-`.

**Citations from the catalog, not the PDF.** Title-page parse has too many edge cases (split DOIs, diacritics, publisher “Citation:” lines). Academic papers already publish a cite-button string. Ingest looks up DOI/PMID on Crossref and PubMed, stores `references.citation_text` (and `bibliographic` jsonb), and Library lets you edit or look up. Generate **References** prefers that stored string. Filename lists and “No retrieved sources” are product bugs, not acceptable UAT output.

**References does not retrieve.** That section’s `preferredSourceRole` is `none`. Calling Grok with an empty retrieve produced “No retrieved sources available; literature review cannot be synthesized.” The section is built from cited file ids after the other sections.

**Pin from the thread, then wait.** Reloading Interrogate before turns load, or opening Prompt while `loadPins` is in flight, showed “No pins yet” even when the database had pins. Stay on the thread, wait for Unpin, then wait for **Pinned passages**.

**Continue keeps Literature Review.** Opening Prompt before the paper row hydrated wrote the default Empirical Study. Generate save used to persist `paper_type` and could clobber Literature Review. Persist no-ops until hydrated; generate save omits `paper_type`. Step 13 waits for “Working on …” before reading the select.

## Troubleshooting

| What you see | What to do |
|---|---|
| Runner exits immediately: key looks like a filesystem path / must start with `xai-` | Replace `GROK_API_KEY` or `UAT/.uat-grok-key` with a real xAI secret. Then `--resume` if steps 1–7 already passed. |
| Profile last4 is `.env` | Same as above. The saved secret was a path. |
| Interrogate/generate HTTP 500, no `[S#]` | Usually a bad key or functions not serving current code. Check `functions serve` logs. Do not mark step 8 PASS. |
| “No pins yet” on Prompt after a successful pin | Wait for the pin list; do not treat the loading empty state as FAIL. If it stays empty, you left the Interrogate thread too early. |
| Continue shows Empirical Study | FAIL. Hydrate/persist bug or generate wrote `paper_type`. Confirm migrations and current SPA. |
| References is “No retrieved sources” | `lookup_citation` / catalog path missing, or generate still retrieving for References. Restart `functions serve` with current code. |
| References is a numbered list of `.pdf` names | FAIL. Stored `citation_text` was empty and the formatter fell back to filenames (that fallback is gone; empty cites must not be faked). Fill Source citations and regenerate. |
| Garbled author (`Ş., A.`) or `Citation:` boilerplate | Stale title-page jsonb without catalog `source`. Look up from DOI/PMID on Library, save, regenerate. |
| Library has no Source citations heading | No `references` rows for this user, or `citation_text` migration not applied / PostgREST schema not reloaded. |
| Index stuck on “Stored (not indexed)” | Storage or `upload_processor` down. **BLOCKED**. Bring Storage up; do not pass ingest. |
| `functions serve` 404 on `lookup_citation` | Restart serve so the new function registers. |
| `--resume` throws | Missing `.uat-state.json`, or step 1/3 notes lack email / `paper=` uuid. Start a new run. |
| Expected 20 PDFs, found N | Restore `UAT/papers/`. **BLOCKED**. |
| Vite `strictPort` failure | Something else is on 5173. Stop it; the runner hard-codes that origin. |
| Confirmation email never arrives | Mailpit `:54324`. Search `to:uat-litrev-…`. Do not disable confirmations. |

## Related

- App how-tos: [`../README.md`](../README.md) (upload, generate, interrogate, Grok key, library)
- Generate pipeline and `lookup_citation`: [`.docs/TECHNICAL_SPECIFICATION.md`](../.docs/TECHNICAL_SPECIFICATION.md)
- GEN-9 (stored citation): [`.docs/PRODUCT_REQUIREMENTS.md`](../.docs/PRODUCT_REQUIREMENTS.md)
- Agent skill: [`.grok/skills/uat-literature-review/SKILL.md`](../.grok/skills/uat-literature-review/SKILL.md)
