-- GEN-8: optional editable outline on the paper. Continue restores it.
ALTER TABLE public.user_papers
  ADD COLUMN IF NOT EXISTS outline text NOT NULL DEFAULT '';
