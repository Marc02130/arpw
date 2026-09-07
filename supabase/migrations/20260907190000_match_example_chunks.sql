-- GEN-7: retrieve own example chunks for style only. Never mixed into evidence allow-list.
-- RLS still applies (INVOKER).

CREATE OR REPLACE FUNCTION public.match_example_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 6
)
RETURNS TABLE (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  section text,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    v.vector_id,
    v.file_id,
    v.chunk_text,
    v.section,
    (1 - (v.vector <=> query_embedding))::double precision AS score
  FROM public.example_vectors v
  JOIN public.examples e ON e.file_id = v.file_id
  WHERE e.user_id = auth.uid()
  ORDER BY v.vector <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 6), 1), 10);
$$;

REVOKE ALL ON FUNCTION public.match_example_chunks(extensions.vector, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_example_chunks(extensions.vector, integer)
  TO authenticated;
