-- INT-3: interrogation Q&A stored as notes on the paper.
-- Not in reference_vectors / match_reference_chunks / citation allow-list.

CREATE TABLE IF NOT EXISTS public.interrogation_turns (
  turn_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  filter_role text,
  passages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interrogation_turns_role_check
    CHECK (role IN ('user', 'assistant')),
  CONSTRAINT interrogation_turns_filter_role_check
    CHECK (
      filter_role IS NULL
      OR filter_role IN ('literature', 'primary', 'both')
    ),
  CONSTRAINT interrogation_turns_content_check
    CHECK (char_length(content) > 0 AND char_length(content) <= 20000),
  CONSTRAINT interrogation_turns_paper_user_fkey
    FOREIGN KEY (paper_id, user_id)
    REFERENCES public.user_papers (paper_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interrogation_turns_paper_created
  ON public.interrogation_turns (paper_id, created_at);

ALTER TABLE public.interrogation_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own interrogation turns" ON public.interrogation_turns;
CREATE POLICY "Users can view own interrogation turns" ON public.interrogation_turns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own interrogation turns" ON public.interrogation_turns;
CREATE POLICY "Users can insert own interrogation turns" ON public.interrogation_turns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON TABLE public.interrogation_turns TO authenticated;
GRANT ALL ON TABLE public.interrogation_turns TO service_role;
