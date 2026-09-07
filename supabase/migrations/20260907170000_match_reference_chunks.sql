-- GEN-4 / generate slice 3: retrieve own reference chunks. RLS still applies (INVOKER).
-- filter_role: literature | primary | both | NULL (same as both).

CREATE OR REPLACE FUNCTION public.match_reference_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 12,
  filter_role text DEFAULT NULL
)
RETURNS TABLE (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  section text,
  source_role text,
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
    r.source_role,
    (1 - (v.vector <=> query_embedding))::double precision AS score
  FROM public.reference_vectors v
  JOIN public."references" r ON r.file_id = v.file_id
  WHERE r.user_id = auth.uid()
    AND (
      filter_role IS NULL
      OR filter_role = 'both'
      OR r.source_role = filter_role
    )
  ORDER BY v.vector <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 12), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text)
  TO authenticated;
