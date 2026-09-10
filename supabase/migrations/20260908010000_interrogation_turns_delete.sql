-- LIB-3: owners can delete their interrogation notes. Paper delete still
-- cascades via interrogation_turns_paper_user_fkey; this lets the SPA clean
-- notes explicitly and matches pinned_passages grants.

DROP POLICY IF EXISTS "Users can delete own interrogation turns" ON public.interrogation_turns;
CREATE POLICY "Users can delete own interrogation turns" ON public.interrogation_turns
  FOR DELETE USING (auth.uid() = user_id);

GRANT DELETE ON TABLE public.interrogation_turns TO authenticated;
