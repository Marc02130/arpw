-- Persist the research prompt on the draft so Continue restores it.
ALTER TABLE public.user_papers
  ADD COLUMN IF NOT EXISTS research_prompt text NOT NULL DEFAULT '';
