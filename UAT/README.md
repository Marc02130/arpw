# Literature-review UAT (Grok Bots)

Dogfood ARPW by drafting a **Literature Review** from the local corpus in `UAT/papers/`. Grok Bots run this playbook. Humans can follow it too.

Do **not** commit files under `UAT/papers/` (copyrighted PDFs). The HTML dump in that folder is not an accepted upload type; skip it.

## Goal

Prove the grounded path on a real pile of papers: upload as literature, index, retrieve, pin, interrogate, generate, preview, save, export. Fail the UAT if a citation is not from the uploaded set, if generate runs without a Grok key, or if indexing never shows chunks.

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

## Preconditions

Local stack, not the hosted Supabase project.

```bash
which supabase   # Homebrew CLI, not npx
docker info
supabase status  # API :54321, Studio :54323, Mailpit :54324
# If Storage or functions are down, bring them up before this UAT.
npm run dev      # http://127.0.0.1:5173
```

If `feat/section-aware-chunks` work is on `main`, apply new migrations (`vector page`, `prefer_section`, `filter_embedding_model`, `hybrid_fts_rrf`) and restart `supabase functions serve --network-id supabase_network_arpw` so `upload_processor`, `embed_text`, `generate_paper`, and `interrogate_corpus` are the current code.

A Grok API key on Profile is required for generate, interrogate, and hosted embeddings. Without a key, ingest still indexes as `hash-384`; generate must refuse with “Save a Grok API key on Profile before generating.”

## Paper to start

- Title: `Gut-brain axis in Alzheimer’s disease: a literature review`
- Type: **Literature Review** (must ignore `primary` / original research)
- Sections: Abstract, Introduction, Literature Review, Discussion, Conclusion, References (leave Methods and Results off)
- Citation style: APA
- Output: Markdown
- Research prompt (paste exactly):

> Synthesize a literature review of the gut-brain axis in Alzheimer’s disease from the uploaded papers only. Cover microbiome, inflammation, omega-3 fatty acids, and clinical-trial evidence. Cite only retrieved [S#] ids. Do not invent studies, n, or outcomes.

## Script

Record **PASS / FAIL / BLOCKED** per step. BLOCKED needs the exact error.

| # | Action | Pass if |
|---|---|---|
| 1 | Open `/login`, sign up, confirm email via Mailpit `:54324`, land on Dashboard | Confirmed session; unconfirmed cannot open `/dashboard` |
| 2 | Profile: save a Grok key | Last4 only; key never shown in full |
| 3 | Dashboard: **Start paper** with the title and Literature Review | Redirect to `/generate?paper=…` |
| 4 | Upload tab: **Literature** only. Upload all 20 PDFs as literature. Do not use Original research. | Each file listed; none rejected for type/size |
| 5 | Wait until index status is not “Stored (not indexed)” (first PDF chunks visible in &lt; 2 min) | At least one file shows a chunk count |
| 6 | Prompt tab: paste the research prompt. **Query sources** | Passages appear with `literature` (not primary). Section labels and `p.N` may show |
| 7 | Pin 2–3 literature chunks to Literature Review or unscoped | Pinned list shows them first on the next Query sources |
| 8 | Interrogate: “What do these papers say about omega-3 and cognition?” Sources: literature | Answer uses only `[S#]` from retrieved passages; unknown ids absent |
| 9 | Interrogate: pin one passage from the answer | Pin appears on Prompt |
| 10 | Generate Paper | Draft saved; headings for selected sections; inline ⚠ / citation / format warnings; footer disclaimer |
| 11 | Spot-check citations | Every `[S#]` was in the queried/pinned set. No invented author-year. Literature Review did not pull original-research files (there are none) |
| 12 | Library: paper listed completed. View preview. Export Markdown and Word | Files download; both include the human-review disclaimer |
| 13 | Continue from library | Prompt tab restores title, type, prompt |

## Fail the UAT

- Generate succeeds with no Grok key
- Draft cites `[S99]` or a file that was not uploaded
- Original-research upload was used for this literature-review paper
- Indexing never produces chunks (Storage/Edge down counts as BLOCKED, not a product fail)
- Export missing `AI-generated draft. Requires human review…`

## Report

Write `UAT/reports/<date>-literature-review.md` (gitignored if it contains draft text from the papers; otherwise a short PASS/FAIL table is fine). Include:

- Operator (Grok Bot id or human)
- Git SHA (`git rev-parse --short HEAD`)
- Embedding model shown after ingest (`hash-384` vs `grok-embedding-small`)
- Files indexed / files failed
- Generate wall time for one section if noted
- Step table
- Screenshots or quoted UI errors
- Verdict: **PASS**, **FAIL**, or **BLOCKED**

Do not paste long draft excerpts that quote the PDFs into git.
