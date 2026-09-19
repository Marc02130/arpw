# Supabase Edge Functions

Local Deno functions for ingest, retrieve, generate, outline, interrogate, and citation lookup. Stay on the Homebrew CLI (`which supabase` is a binary, not `npx`). Do not deploy these to hosted project `uqcjcnnpqukxpwumugsp` from this playbook.

## Serve (local)

The Docker network name is **`supabase_network_arpw`**.

```bash
supabase functions serve --network-id supabase_network_arpw
```

Restart after pulling Edge code. Catalog lookup (Crossref, PubMed, doi.org) needs that network id.

Required functions: `upload_processor`, `embed_text`, `generate_paper`, `generate_outline`, `interrogate_corpus`, `lookup_citation`.

## Functions

### interrogate_corpus

Grounded Q&A on the current paper’s literature and/or original research. Auth JWT required. Same Grok key path as generate (`read_grok_api_key`; SPA never sees it). Retrieves with `match_reference_chunks` only — no example papers — then filters academic `chunk_role` (citation/boilerplate dropped unless the question asks for references). Client `sourceIds` / `systemPrompt` are ignored. Drops `[S#]` citations that were not in the retrieved set. Missing key: HTTP 400 `missing_grok_key`. The SPA persists the turn as notes.

### generate_paper

Section-by-section draft. Auth JWT required. Reads the Grok key with service_role `read_grok_api_key`. Retrieves chunks itself (pins first) — client `sourceIds` / `systemPrompt` are ignored. Drops unknown `[S#]`. One uncited repair pass per section. Missing key: HTTP 400 `missing_grok_key`.

POST body: `{ paperId, paperType, sections, researchPrompt, citationStyle?, outputFormat? }`. After Grok, updates that `user_papers` row and replaces `paper_references` with cited file ids the user owns. Does not write `paper_type`.

### generate_outline

Optional Prompt-tab outline. Same retrieve + Grok key path. Saves `user_papers.outline`.

### lookup_citation

DOI/PMID catalog lookup (Crossref, then PubMed, then doi.org APA cite). Needs `--network-id supabase_network_arpw`.

### upload_processor

Parses PDF/DOCX/TXT, splits on IMRaD headings, skips captions/author-contribution/page-number soup, labels academic `chunk_role`, embeds (`grok-embedding-small` with a key, else `hash-384`), stores vectors. Bibliography chunks are stored (interrogation drops them unless asked). Best-effort DOI/PMID catalog fill on literature files.

POST: `{ fileId, fileName, fileSize, documentType }`. Downloads `{auth.uid()}/{fileId}` from `references` or `examples`. Does not take `storagePath` or `userId` from the client.

### embed_text

Hosted `grok-embedding-small` (384-d) with `query:` / `passage:` prefixes. Hash-384 fallback.

## Deno

Each function has its own `deno.json` (`"lock": false`). Shared helpers live in `_shared/` and must be imported with `.ts` extensions.
