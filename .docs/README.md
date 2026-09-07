# DOCUMENTS

## Overview

Index of product and engineering specs for ARPW. These files are the source of intent. README feature bullets are not.

## Content

| File | What it is |
|---|---|
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Intended MVP: who it is for, requirement IDs, cut line |
| [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) | As-built architecture plus TARGET RAG pipeline |
| [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) | PRD vs code; build order |
| [legacy/](./legacy/) | Superseded drafts; do not treat as status |

Start with the gap analysis if you are about to write code. For a first-run walkthrough (install, confirm email, reset password, upload, Grok key), use `../README.md`.

## References

- Local setup: `../README.md`
- Schema: `../supabase/migrations/20260906133100_init.sql`, `../supabase/migrations/20260907000000_grok_key_storage.sql`, `../supabase/migrations/20260907010000_reference_upload_cap.sql`, `../supabase/migrations/20260907120000_example_upload_cap.sql`
