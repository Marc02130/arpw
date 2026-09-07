-- QUAL-1: per-sentence attribution JSON (chunk ids + quote spans, or uncited).
ALTER TABLE public.user_papers
  ADD COLUMN IF NOT EXISTS attribution jsonb NOT NULL DEFAULT '[]'::jsonb;
