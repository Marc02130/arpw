-- PIN-1: structured pins (vector_id + file_id) on the current paper.
-- Composite FKs require unique (id, user_id) / (vector_id, file_id) on parents.

ALTER TABLE public.user_papers
  DROP CONSTRAINT IF EXISTS user_papers_paper_id_user_id_key;
ALTER TABLE public.user_papers
  ADD CONSTRAINT user_papers_paper_id_user_id_key UNIQUE (paper_id, user_id);

ALTER TABLE public."references"
  DROP CONSTRAINT IF EXISTS references_file_id_user_id_key;
ALTER TABLE public."references"
  ADD CONSTRAINT references_file_id_user_id_key UNIQUE (file_id, user_id);

ALTER TABLE public.reference_vectors
  DROP CONSTRAINT IF EXISTS reference_vectors_vector_id_file_id_key;
ALTER TABLE public.reference_vectors
  ADD CONSTRAINT reference_vectors_vector_id_file_id_key UNIQUE (vector_id, file_id);

CREATE TABLE IF NOT EXISTS public.pinned_passages (
  pin_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL,
  file_id uuid NOT NULL,
  vector_id uuid NOT NULL,
  target_section text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pinned_passages_target_section_check
    CHECK (
      target_section IS NULL
      OR target_section IN (
        'Abstract',
        'Introduction',
        'Literature Review',
        'Methods',
        'Results',
        'Discussion',
        'Conclusion',
        'References'
      )
    ),
  CONSTRAINT pinned_passages_paper_user_fkey
    FOREIGN KEY (paper_id, user_id)
    REFERENCES public.user_papers (paper_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT pinned_passages_file_user_fkey
    FOREIGN KEY (file_id, user_id)
    REFERENCES public."references" (file_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT pinned_passages_vector_file_fkey
    FOREIGN KEY (vector_id, file_id)
    REFERENCES public.reference_vectors (vector_id, file_id)
    ON DELETE CASCADE,
  CONSTRAINT pinned_passages_paper_vector_key UNIQUE (paper_id, vector_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_passages_paper_id ON public.pinned_passages (paper_id);
CREATE INDEX IF NOT EXISTS idx_pinned_passages_user_id ON public.pinned_passages (user_id);

ALTER TABLE public.pinned_passages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pins" ON public.pinned_passages;
CREATE POLICY "Users can view own pins" ON public.pinned_passages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pins" ON public.pinned_passages;
CREATE POLICY "Users can insert own pins" ON public.pinned_passages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pins" ON public.pinned_passages;
CREATE POLICY "Users can delete own pins" ON public.pinned_passages
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON TABLE public.pinned_passages TO authenticated;
GRANT ALL ON TABLE public.pinned_passages TO service_role;
