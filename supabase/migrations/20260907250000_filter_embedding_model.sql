-- Do not mix hash-384 with grok-embedding-small in one cosine search.

DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text);
DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text, text);
DROP FUNCTION IF EXISTS public.match_reference_chunks(extensions.vector, integer, text, text, text);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer, text);
DROP FUNCTION IF EXISTS public.match_example_chunks(extensions.vector, integer, text, text);

CREATE FUNCTION public.match_reference_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 12,
  filter_role text DEFAULT NULL,
  prefer_section text DEFAULT NULL,
  filter_model text DEFAULT 'hash-384'
)
RETURNS TABLE (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  section text,
  source_role text,
  score double precision,
  page integer
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
    (1 - (v.vector <=> query_embedding))::double precision AS score,
    v.page
  FROM public.reference_vectors v
  JOIN public."references" r ON r.file_id = v.file_id
  WHERE r.user_id = auth.uid()
    AND coalesce(v.embedding_model, 'hash-384') = coalesce(nullif(btrim(filter_model), ''), 'hash-384')
    AND (
      filter_role IS NULL
      OR filter_role = 'both'
      OR r.source_role = filter_role
    )
  ORDER BY
    CASE
      WHEN prefer_section IS NULL OR btrim(prefer_section) = '' THEN 0
      WHEN lower(coalesce(v.section, '')) = lower(btrim(prefer_section)) THEN 0
      ELSE 1
    END,
    v.vector <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 12), 1), 20);
$$;

CREATE FUNCTION public.match_example_chunks(
  query_embedding extensions.vector(384),
  match_count integer DEFAULT 6,
  prefer_section text DEFAULT NULL,
  filter_model text DEFAULT 'hash-384'
)
RETURNS TABLE (
  vector_id uuid,
  file_id uuid,
  chunk_text text,
  section text,
  score double precision,
  page integer
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
    (1 - (v.vector <=> query_embedding))::double precision AS score,
    v.page
  FROM public.example_vectors v
  JOIN public.examples e ON e.file_id = v.file_id
  WHERE e.user_id = auth.uid()
    AND coalesce(v.embedding_model, 'hash-384') = coalesce(nullif(btrim(filter_model), ''), 'hash-384')
  ORDER BY
    CASE
      WHEN prefer_section IS NULL OR btrim(prefer_section) = '' THEN 0
      WHEN lower(coalesce(v.section, '')) = lower(btrim(prefer_section)) THEN 0
      ELSE 1
    END,
    v.vector <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 6), 1), 10);
$$;

REVOKE ALL ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_reference_chunks(extensions.vector, integer, text, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.match_example_chunks(extensions.vector, integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_example_chunks(extensions.vector, integer, text, text)
  TO authenticated;
